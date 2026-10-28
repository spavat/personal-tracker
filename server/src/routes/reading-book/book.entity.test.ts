import { describe, expect, it } from "vitest";

import { buildInitialReading, buildTitleMap, getLongestConsecutiveStreak, median } from "./book.entity";

describe("buildTitleMap", () => {
	it("maps id -> title for flat items", () => {
		const map = buildTitleMap([
			{ id: "a", title: "Chapter A" },
			{ id: "b", title: "Chapter B" },
		]);
		expect(map).toEqual({ a: "Chapter A", b: "Chapter B" });
	});

	it("skips items without a title", () => {
		const map = buildTitleMap([{ id: "a", title: "Chapter A" }, { id: "b" }]);
		expect(map).toEqual({ a: "Chapter A" });
	});

	it("recurses into nested content", () => {
		const map = buildTitleMap([
			{
				id: "part1",
				title: "Part 1",
				content: [
					{ id: "c1", title: "Chapter 1" },
					{ id: "c2", title: "Chapter 2", content: [{ id: "s1", title: "Section 1" }] },
				],
			},
		]);
		expect(map).toEqual({ part1: "Part 1", c1: "Chapter 1", c2: "Chapter 2", s1: "Section 1" });
	});
});

describe("getLongestConsecutiveStreak", () => {
	it("returns zeros for an empty list", () => {
		expect(getLongestConsecutiveStreak([])).toEqual({ days: 0, start: null, end: null });
	});

	it("returns a single-day streak for one date", () => {
		expect(getLongestConsecutiveStreak(["2024-06-01"])).toEqual({
			days: 1,
			start: "2024-06-01",
			end: "2024-06-01",
		});
	});

	it("finds a fully consecutive run", () => {
		expect(getLongestConsecutiveStreak(["2024-06-01", "2024-06-02", "2024-06-03"])).toEqual({
			days: 3,
			start: "2024-06-01",
			end: "2024-06-03",
		});
	});

	it("picks the longest run when there are gaps, regardless of input order", () => {
		expect(
			getLongestConsecutiveStreak([
				"2024-06-10",
				"2024-06-01",
				"2024-06-11",
				"2024-06-02",
				"2024-06-12",
				"2024-06-13",
			]),
		).toEqual({ days: 4, start: "2024-06-10", end: "2024-06-13" });
	});

	it("keeps the first run on a tie", () => {
		expect(getLongestConsecutiveStreak(["2024-06-01", "2024-06-02", "2024-06-05", "2024-06-06"])).toEqual({
			days: 2,
			start: "2024-06-01",
			end: "2024-06-02",
		});
	});

	it("handles a month boundary as consecutive", () => {
		expect(getLongestConsecutiveStreak(["2024-01-31", "2024-02-01"])).toEqual({
			days: 2,
			start: "2024-01-31",
			end: "2024-02-01",
		});
	});
});

describe("median", () => {
	it("returns the middle value for an odd-length list", () => {
		expect(median([3, 1, 2])).toBe(2);
	});

	it("averages the two middle values for an even-length list", () => {
		expect(median([1, 2, 3, 4])).toBe(2.5);
	});

	it("does not mutate the input", () => {
		const input = [5, 1, 3];
		median(input);
		expect(input).toEqual([5, 1, 3]);
	});

	it("throws on an empty list", () => {
		expect(() => median([])).toThrow("Cannot calculate median of an empty array");
	});
});

describe("buildInitialReading", () => {
	it("returns an in-progress reading with no details and a fresh id", () => {
		const a = buildInitialReading();
		const b = buildInitialReading();

		expect(a).toMatchObject({ status: "in-progress", details: [] });
		expect(a.id).toEqual(expect.any(String));
		expect(a.id).not.toBe(b.id);
	});
});
