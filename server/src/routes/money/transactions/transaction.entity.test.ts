import { describe, expect, it } from "vitest";

import { mergeAndSortTransactions, normalizeTransactionRefs } from "./transaction.entity";

describe("normalizeTransactionRefs", () => {
	it("turns a 0 categoryId / paymentTypeId into null and keeps other values", () => {
		expect(normalizeTransactionRefs({ categoryId: 0, paymentTypeId: 4, name: "x" } as never)).toEqual({
			categoryId: null,
			paymentTypeId: 4,
			name: "x",
		});
	});

	it("leaves non-zero refs untouched", () => {
		expect(normalizeTransactionRefs({ categoryId: 3, paymentTypeId: 7 } as never)).toEqual({
			categoryId: 3,
			paymentTypeId: 7,
		});
	});
});

describe("mergeAndSortTransactions", () => {
	it("merges both lists and sorts by date then time ascending", () => {
		const direct = [
			{ ref: "d1", date: "2024-03-01", time: "10:00" },
			{ ref: "d2", date: "2024-01-01", time: "09:00" },
		];
		const sub = [
			{ ref: "s1", date: "2024-01-01", time: "08:00" },
			{ ref: "s2", date: "2024-01-01" },
		];

		expect(mergeAndSortTransactions(direct, sub).map((t) => t.ref)).toEqual(["s2", "s1", "d2", "d1"]);
	});
});
