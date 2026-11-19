import { describe, expect, it, vi } from "vitest";

import type { TransactionRepository } from "../transactions/transaction.repository";
import type { BankRepository } from "./bank.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	CreateBankUseCase,
	DeleteBankUseCase,
	GetBanksOverviewUseCase,
	GetBanksTreeUseCase,
	GetBankUseCase,
	ListBanksUseCase,
	UpdateBankUseCase,
} from "./bank.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue({ id: 1 }),
		update: vi.fn().mockResolvedValue({ id: 1 }),
		findByIdWithAccountsForDelete: vi.fn().mockResolvedValue(null),
		destroy: vi.fn().mockResolvedValue(undefined),
		findAllWithAccountHistoryAndPaymentTypes: vi.fn().mockResolvedValue([]),
		findAllWithAccountsAndPaymentTypes: vi.fn().mockResolvedValue([]),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as BankRepository;

describe("bank CRUD use cases", () => {
	it("delegate through to the repository", () => {
		const repo = fakeRepo();
		new ListBanksUseCase(asRepo(repo)).execute(asLog(makeLog()));
		new GetBankUseCase(asRepo(repo)).execute(1, asLog(makeLog()));
		new CreateBankUseCase(asRepo(repo)).execute({ name: "N26" } as any, asLog(makeLog()));
		new UpdateBankUseCase(asRepo(repo)).execute({ id: 1, data: { name: "N" } as any }, asLog(makeLog()));
		new GetBanksTreeUseCase(asRepo(repo)).execute(asLog(makeLog()));

		expect(repo.findAll).toHaveBeenCalled();
		expect(repo.findById).toHaveBeenCalledWith(1);
		expect(repo.create).toHaveBeenCalledWith({ name: "N26" });
		expect(repo.update).toHaveBeenCalledWith(1, { name: "N" });
		expect(repo.findAllWithAccountsAndPaymentTypes).toHaveBeenCalled();
	});
});

describe("DeleteBankUseCase", () => {
	it("throws when the bank does not exist", async () => {
		await expect(new DeleteBankUseCase(asRepo(fakeRepo())).execute(3, asLog(makeLog()))).rejects.toThrow(
			"Banque (3) non trouvée",
		);
	});

	it("refuses to delete a bank that still has accounts", async () => {
		const repo = fakeRepo();
		repo.findByIdWithAccountsForDelete.mockResolvedValue({ accounts: [{}] });
		await expect(new DeleteBankUseCase(asRepo(repo)).execute(3, asLog(makeLog()))).rejects.toThrow(
			"possède encore des comptes",
		);
	});

	it("destroys a bank with no accounts", async () => {
		const repo = fakeRepo();
		const bank = { accounts: [] };
		repo.findByIdWithAccountsForDelete.mockResolvedValue(bank);
		await new DeleteBankUseCase(asRepo(repo)).execute(3, asLog(makeLog()));
		expect(repo.destroy).toHaveBeenCalledWith(bank);
	});
});

describe("GetBanksOverviewUseCase", () => {
	it("adds matching transaction amounts onto each account's latest history entry", async () => {
		const repo = fakeRepo();
		const banks = [{ accounts: [{ id: 10, name: "Checking", history: [{ date: "2024-01-01", amount: 100 }] }] }];
		repo.findAllWithAccountHistoryAndPaymentTypes.mockResolvedValue(banks);
		const transactionRepo = {
			findAllForBanksOverview: vi.fn().mockResolvedValue([
				{
					date: "2024-02-01",
					informative: false,
					amount: 50,
					paymentType: { account: { id: 10 } },
					children: [],
				},
			]),
		};

		const result = await new GetBanksOverviewUseCase(
			asRepo(repo),
			transactionRepo as unknown as TransactionRepository,
		).execute(asLog(makeLog()));

		expect(transactionRepo.findAllForBanksOverview).toHaveBeenCalledWith({ from: "2024-01-01" });
		expect((result as any)[0].accounts[0].history[0].amount).toBe(150);
	});
});
