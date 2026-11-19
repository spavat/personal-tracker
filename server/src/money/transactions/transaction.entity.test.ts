import { describe, expect, it } from "vitest";

import { mergeAndSortTransactions } from "./transaction.entity.js";

describe("mergeAndSortTransactions", () => {
	it("merges both lists and sorts by date then time ascending, no time first", () => {
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
