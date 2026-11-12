import { describe, expect, it, vi } from "vitest";

import type { CreateTransactionUseCase } from "../transactions/transaction.useCases";
import type { BankingRepository } from "./banking.repository";
import type { EbTransaction, EnableBankingClient } from "./enable-banking.client";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	AcceptBankTransactionUseCase,
	CompleteConnectionUseCase,
	MatchBankTransactionUseCase,
	SyncUseCase,
} from "./banking.useCases";
import { EnableBankingError } from "./enable-banking.client";

const log = () => asLog(makeLog());

function fakeRepo() {
	return {
		listConnections: vi.fn().mockResolvedValue([]),
		findConnection: vi.fn().mockResolvedValue(undefined),
		findConnectionByState: vi.fn().mockResolvedValue(undefined),
		updateConnection: vi.fn().mockResolvedValue(undefined),
		createConnectionAccount: vi.fn().mockResolvedValue(undefined),
		updateConnectionAccount: vi.fn().mockResolvedValue(undefined),
		findAccountByIban: vi.fn().mockResolvedValue(undefined),
		findKnownExternalIds: vi.fn().mockResolvedValue(new Set()),
		insertBankTransactions: vi.fn().mockResolvedValue(undefined),
		purgeIgnored: vi.fn().mockResolvedValue(undefined),
		findBankTransaction: vi.fn().mockResolvedValue(undefined),
		deleteBankTransaction: vi.fn().mockResolvedValue(undefined),
		findTransaction: vi.fn().mockResolvedValue(undefined),
		linkTransaction: vi.fn().mockResolvedValue(undefined),
		runInTransaction: vi.fn((fn: (t: unknown) => unknown) => fn("tx")),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as BankingRepository;

function fakeClient() {
	return {
		createSession: vi.fn(),
		deleteSession: vi.fn().mockResolvedValue({}),
		listTransactions: vi.fn().mockResolvedValue([]),
	};
}
const asClient = (c: ReturnType<typeof fakeClient>) => c as unknown as EnableBankingClient;

const bankTx = (ref: string): EbTransaction => ({
	entry_reference: ref,
	transaction_amount: { currency: "EUR", amount: "10.00" },
	credit_debit_indicator: "DBIT",
	status: "BOOK",
	booking_date: "2026-11-02",
	remittance_information: ["CB SHOP"],
});

const connection = (overrides = {}) => ({
	id: 1,
	status: "authorized",
	validUntil: "2099-01-01T00:00:00Z",
	lastSyncSuccessAt: null,
	accounts: [{ id: 10, uid: "uid-1", identificationHash: "h1", accountId: 5, enabled: true, syncFrom: "2026-10-01" }],
	...overrides,
});

describe("SyncUseCase", () => {
	it("inserts only lines not already in transactions or inbox", async () => {
		const repo = fakeRepo();
		const client = fakeClient();
		repo.listConnections.mockResolvedValue([connection()]);
		client.listTransactions.mockResolvedValue([bankTx("A"), bankTx("B")]);
		repo.findKnownExternalIds.mockResolvedValue(new Set(["h1:A"]));

		const result = await new SyncUseCase(asRepo(repo), asClient(client)).execute({ force: false }, log());

		expect(result).toEqual({ imported: 1 });
		expect(client.listTransactions).toHaveBeenCalledWith("uid-1", "2026-10-01");
		expect(repo.insertBankTransactions).toHaveBeenCalledWith([
			expect.objectContaining({ externalId: "h1:B", connectionAccountId: 10, amount: -10 }),
		]);
		expect(repo.updateConnection).toHaveBeenCalledWith(1, expect.objectContaining({ lastError: null }));
	});

	it("skips connections synced less than a day ago unless forced, and unlinked accounts", async () => {
		const repo = fakeRepo();
		const client = fakeClient();
		repo.listConnections.mockResolvedValue([
			connection({ lastSyncSuccessAt: new Date().toISOString() }),
			connection({
				id: 2,
				accounts: [{ id: 11, uid: "u", identificationHash: "h", accountId: null, enabled: true }],
			}),
		]);

		await new SyncUseCase(asRepo(repo), asClient(client)).execute({ force: false }, log());
		expect(client.listTransactions).not.toHaveBeenCalled();

		await new SyncUseCase(asRepo(repo), asClient(client)).execute({ force: true }, log());
		expect(client.listTransactions).toHaveBeenCalledTimes(1);
	});

	it("marks the connection expired when the session expired", async () => {
		const repo = fakeRepo();
		const client = fakeClient();
		repo.listConnections.mockResolvedValue([connection()]);
		client.listTransactions.mockRejectedValue(new EnableBankingError(401, "EXPIRED_SESSION", "Session is expired"));

		await new SyncUseCase(asRepo(repo), asClient(client)).execute({ force: true }, log());

		expect(repo.updateConnection).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ status: "expired", lastError: "Session is expired" }),
		);
	});

	it("does not touch expired connections", async () => {
		const repo = fakeRepo();
		const client = fakeClient();
		repo.listConnections.mockResolvedValue([connection({ validUntil: "2020-01-01T00:00:00Z" })]);
		await new SyncUseCase(asRepo(repo), asClient(client)).execute({ force: true }, log());
		expect(client.listTransactions).not.toHaveBeenCalled();
	});
});

describe("CompleteConnectionUseCase", () => {
	it("re-attaches known accounts by identification hash and auto-links new ones by IBAN", async () => {
		const repo = fakeRepo();
		const client = fakeClient();
		repo.findConnectionByState.mockResolvedValue({ id: 1, sessionId: "old" });
		repo.findConnection.mockResolvedValue({ id: 1, accounts: [{ id: 10, identificationHash: "known" }] });
		repo.findAccountByIban.mockResolvedValue({ id: 5 });
		client.createSession.mockResolvedValue({
			session_id: "new",
			access: { valid_until: "2027-05-01T00:00:00Z" },
			accounts: [
				{ uid: "u1", identification_hash: "known", account_id: { iban: "FR76 1111" } },
				{ uid: "u2", identification_hash: "fresh", account_id: { iban: "fr76 2222" } },
			],
		});

		await new CompleteConnectionUseCase(asRepo(repo), asClient(client)).execute({ code: "c", state: "s" }, log());

		expect(repo.updateConnectionAccount).toHaveBeenCalledWith(10, expect.objectContaining({ uid: "u1" }));
		expect(repo.findAccountByIban).toHaveBeenCalledWith("FR762222");
		expect(repo.createConnectionAccount).toHaveBeenCalledWith(
			expect.objectContaining({ identificationHash: "fresh", accountId: 5, connectionId: 1 }),
		);
		expect(repo.updateConnection).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ sessionId: "new", status: "authorized", authState: null }),
		);
		expect(client.deleteSession).toHaveBeenCalledWith("old");
	});

	it("refuses an unknown state", async () => {
		await expect(
			new CompleteConnectionUseCase(asRepo(fakeRepo()), asClient(fakeClient())).execute(
				{ code: "c", state: "s" },
				log(),
			),
		).rejects.toThrow("Autorisation inconnue");
	});
});

const inboxLine = {
	id: 3,
	externalId: "h1:A",
	label: "CB SHOP",
	amount: -10,
	transactionDate: null,
	bookingDate: "2026-11-02",
	ignored: false,
	connectionAccount: { account: { id: 5, name: "Courant", paymentTypes: [{ id: 7 }] } },
};

const acceptBody = {
	name: "Shop",
	date: "2026-11-02",
	considerationDate: "2026-11-02",
	recurrent: false,
	informative: false,
	categoryId: 0,
	paymentTypeId: 7,
	tags: [],
	children: [],
};

describe("AcceptBankTransactionUseCase", () => {
	it("creates the transaction with the bank amount and key, then deletes the inbox line", async () => {
		const repo = fakeRepo();
		repo.findBankTransaction.mockResolvedValue(inboxLine);
		const create = { execute: vi.fn().mockResolvedValue({ id: 99 }) };

		const result = await new AcceptBankTransactionUseCase(
			asRepo(repo),
			create as unknown as CreateTransactionUseCase,
		).execute(3, { ...acceptBody, amount: 1000 } as never, log());

		expect(result).toEqual({ id: 99 });
		expect(create.execute).toHaveBeenCalledWith(
			expect.objectContaining({ amount: -10, externalId: "h1:A", bankLabel: "CB SHOP", paymentTypeId: 7 }),
			expect.anything(),
			{ transaction: "tx" },
		);
		expect(repo.deleteBankTransaction).toHaveBeenCalledWith(3, { transaction: "tx" });
	});

	it("rejects a payment type of another account", async () => {
		const repo = fakeRepo();
		repo.findBankTransaction.mockResolvedValue(inboxLine);
		const create = { execute: vi.fn() };
		await expect(
			new AcceptBankTransactionUseCase(asRepo(repo), create as unknown as CreateTransactionUseCase).execute(
				3,
				{ ...acceptBody, paymentTypeId: 8 },
				log(),
			),
		).rejects.toThrow("moyen de paiement");
		expect(create.execute).not.toHaveBeenCalled();
	});
});

describe("MatchBankTransactionUseCase", () => {
	it("links the manual transaction and deletes the inbox line", async () => {
		const repo = fakeRepo();
		repo.findBankTransaction.mockResolvedValue(inboxLine);
		repo.findTransaction.mockResolvedValue({
			id: 42,
			amount: -10,
			date: "2026-11-01",
			externalId: null,
			paymentType: { accountId: 5 },
		});

		await new MatchBankTransactionUseCase(asRepo(repo)).execute(3, 42, log());

		expect(repo.linkTransaction).toHaveBeenCalledWith(
			42,
			{ externalId: "h1:A", bankLabel: "CB SHOP" },
			{ transaction: "tx" },
		);
		expect(repo.deleteBankTransaction).toHaveBeenCalledWith(3, { transaction: "tx" });
	});

	it("refuses a transaction with another amount", async () => {
		const repo = fakeRepo();
		repo.findBankTransaction.mockResolvedValue(inboxLine);
		repo.findTransaction.mockResolvedValue({
			id: 42,
			amount: -12,
			date: "2026-11-01",
			externalId: null,
			paymentType: { accountId: 5 },
		});
		await expect(new MatchBankTransactionUseCase(asRepo(repo)).execute(3, 42, log())).rejects.toThrow(
			"ne correspond pas",
		);
	});
});
