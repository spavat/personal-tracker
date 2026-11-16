import { describe, expect, it } from "vitest";

import type { EbTransaction } from "./enable-banking.client";

import {
	computeDateFrom,
	connectionStatus,
	isMatchCandidate,
	isSyncDue,
	statusAfterError,
	suggestPaymentType,
	toBankLines,
} from "./banking.entity";

function tx(overrides: Partial<EbTransaction> = {}): EbTransaction {
	return {
		entry_reference: "REF1",
		transaction_amount: { currency: "EUR", amount: "3.50" },
		credit_debit_indicator: "DBIT",
		status: "BOOK",
		booking_date: "2026-11-02",
		value_date: "2026-11-03",
		transaction_date: "2026-11-01",
		remittance_information: ["CB  CAFE DU COIN", "PARIS"],
		...overrides,
	};
}

describe("toBankLines", () => {
	it("maps a debit to a negative amount with the joined remittance as label", () => {
		const [line] = toBankLines("acc", [tx()]);
		expect(line).toMatchObject({
			externalId: "acc:REF1",
			amount: -3.5,
			label: "CB CAFE DU COIN PARIS",
			transactionDate: "2026-11-01",
			bookingDate: "2026-11-02",
			valueDate: "2026-11-03",
		});
	});

	it("keeps credits positive", () => {
		expect(toBankLines("acc", [tx({ credit_debit_indicator: "CRDT" })])[0].amount).toBe(3.5);
	});

	it("gives different keys to the same entry_reference on two bank accounts", () => {
		const [a] = toBankLines("bank-a", [tx()]);
		const [b] = toBankLines("bank-b", [tx()]);
		expect(a.externalId).not.toBe(b.externalId);
	});

	it("adds a content hash when the bank repeats a reference on different lines", () => {
		const lines = toBankLines("acc", [tx(), tx({ transaction_amount: { currency: "EUR", amount: "8.00" } })]);
		expect(new Set(lines.map((l) => l.externalId)).size).toBe(2);
		expect(lines[0].externalId).toMatch(/^acc:REF1:[0-9a-f]+$/);
	});

	it("numbers identical lines without reference, with the same keys on the next fetch", () => {
		const fetch = () => toBankLines("acc", [tx({ entry_reference: null }), tx({ entry_reference: null })]);
		const first = fetch().map((l) => l.externalId);
		expect(first[0]).toMatch(/^acc:h:[0-9a-f]+#1$/);
		expect(first[1]).toMatch(/#2$/);
		expect(fetch().map((l) => l.externalId)).toEqual(first);
	});
});

describe("computeDateFrom", () => {
	it("starts at syncFrom on the first sync", () => {
		expect(computeDateFrom("2026-10-01", null)).toBe("2026-10-01");
	});

	it("goes back 10 days before the last success", () => {
		expect(computeDateFrom("2026-01-01", "2026-11-07T08:00:00.000Z")).toBe("2026-10-28");
	});

	it("never goes before syncFrom", () => {
		expect(computeDateFrom("2026-11-01", "2026-11-07T08:00:00.000Z")).toBe("2026-11-01");
	});
});

describe("connection status", () => {
	const now = new Date("2026-11-07T10:00:00Z");

	it("reports an authorized connection past its validity as expired", () => {
		expect(connectionStatus({ status: "authorized", validUntil: "2026-11-01T00:00:00Z" }, now)).toBe("expired");
		expect(connectionStatus({ status: "authorized", validUntil: "2027-01-01T00:00:00Z" }, now)).toBe("authorized");
	});

	it("maps Enable Banking errors", () => {
		expect(statusAfterError("EXPIRED_SESSION")).toBe("expired");
		expect(statusAfterError("REVOKED_SESSION")).toBe("revoked");
		expect(statusAfterError("ASPSP_RATE_LIMIT_EXCEEDED")).toBeNull();
		expect(statusAfterError(undefined)).toBe("error");
	});

	it("syncs once a day", () => {
		expect(isSyncDue(null, now)).toBe(true);
		expect(isSyncDue("2026-11-07T01:00:00Z", now)).toBe(false);
		expect(isSyncDue("2026-11-06T09:00:00Z", now)).toBe(true);
	});
});

describe("isMatchCandidate", () => {
	const line = { amount: -12.4, transactionDate: "2026-11-01", bookingDate: "2026-11-03" };

	it("accepts the same amount within 3 days", () => {
		expect(isMatchCandidate(line, { amount: -12.4, date: "2026-10-30", externalId: null })).toBe(true);
		expect(isMatchCandidate(line, { amount: -12.4, date: "2026-11-06", externalId: null })).toBe(true);
	});

	it("rejects another amount, a date too far, or an already linked transaction", () => {
		expect(isMatchCandidate(line, { amount: -12, date: "2026-11-01", externalId: null })).toBe(false);
		expect(isMatchCandidate(line, { amount: -12.4, date: "2026-11-10", externalId: null })).toBe(false);
		expect(isMatchCandidate(line, { amount: -12.4, date: "2026-11-01", externalId: "x" })).toBe(false);
	});
});

describe("suggestPaymentType", () => {
	const types = [
		{ id: 1, name: "CB" },
		{ id: 2, name: "Virement" },
		{ id: 3, name: "Prélèvement" },
	];

	it("guesses from the label", () => {
		expect(suggestPaymentType({ label: "CB CARREFOUR 12/11", bankTransactionCode: null }, types)).toBe(1);
		expect(suggestPaymentType({ label: "VIR SEPA LOYER", bankTransactionCode: null }, types)).toBe(2);
		expect(suggestPaymentType({ label: "PRLV EDF", bankTransactionCode: null }, types)).toBe(3);
	});

	it("falls back to the only payment type, else nothing", () => {
		expect(suggestPaymentType({ label: "???", bankTransactionCode: null }, [types[0]])).toBe(1);
		expect(suggestPaymentType({ label: "???", bankTransactionCode: null }, types)).toBeNull();
	});
});
