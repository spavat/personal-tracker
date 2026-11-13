import { describe, expect, it } from "vitest";

import {
	attributeDay,
	buildImportRows,
	computeCatchUp,
	diffTotals,
	findGame,
	isRunDue,
	lastRunSlot,
	nextRunSlot,
	normalizeName,
	playDay,
	type StoreTotal,
} from "./sync.entity";

const at = (iso: string) => Temporal.Instant.from(iso);

describe("playDay", () => {
	it("gives 04:00 to the previous day: it closes that day's window", () => {
		expect(playDay(at("2026-11-14T04:00:00+01:00"))).toBe("2026-11-13");
	});

	it("keeps the night before 04:00 on the previous day", () => {
		expect(playDay(at("2026-11-14T03:59:59+01:00"))).toBe("2026-11-13");
		expect(playDay(at("2026-11-14T00:30:00+01:00"))).toBe("2026-11-13");
	});

	it("starts a new day right after 04:00", () => {
		expect(playDay(at("2026-11-14T04:00:01+01:00"))).toBe("2026-11-14");
		expect(playDay(at("2026-11-13T23:00:00+01:00"))).toBe("2026-11-13");
	});

	it("uses the Paris wall clock on the spring DST change", () => {
		expect(playDay(at("2026-03-29T04:00:00+02:00"))).toBe("2026-03-28");
		expect(playDay(at("2026-03-29T04:30:00+02:00"))).toBe("2026-03-29");
	});

	it("uses the Paris wall clock on the autumn DST change", () => {
		expect(playDay(at("2026-10-25T04:00:00+01:00"))).toBe("2026-10-24");
		expect(playDay(at("2026-10-25T04:30:00+01:00"))).toBe("2026-10-25");
	});
});

describe("attributeDay", () => {
	// baseline fetched on the 10th at 04:00, then runs missed until the 13th at 04:00
	const from = at("2026-11-10T04:00:00+01:00");
	const to = at("2026-11-13T04:00:00+01:00");

	it("writes to the latest day without a last session", () => {
		expect(attributeDay(from, to)).toBe("2026-11-12");
	});

	it("writes to the last session's day when it falls inside the window", () => {
		expect(attributeDay(from, to, "2026-11-11T21:00:00+01:00")).toBe("2026-11-11");
	});

	it("applies the 04:00 rule to the last session too", () => {
		expect(attributeDay(from, to, "2026-11-12T02:00:00+01:00")).toBe("2026-11-11");
	});

	it("ignores a last session outside the window", () => {
		expect(attributeDay(from, to, "2026-11-09T21:00:00+01:00")).toBe("2026-11-12");
	});
});

describe("diffTotals", () => {
	const total = (storeGameId: string, seconds: number, extra: Partial<StoreTotal> = {}): StoreTotal => ({
		storeGameId,
		origin: "steam",
		seconds,
		...extra,
	});

	it("returns the minutes played per game", () => {
		const { diffs } = diffTotals([total("1145350", 3600)], [total("1145350", 5400, { lastPlayed: "x" })]);
		expect(diffs).toEqual([{ storeGameId: "1145350", origin: "steam", minutes: 30, lastPlayed: "x" }]);
	});

	it("keeps Steam and Steam Deck apart for the same game", () => {
		const prev = [total("1942280", 600), total("1942280", 600, { origin: "steam-deck" })];
		const curr = [total("1942280", 600), total("1942280", 1800, { origin: "steam-deck" })];
		expect(diffTotals(prev, curr).diffs).toEqual([{ storeGameId: "1942280", origin: "steam-deck", minutes: 20 }]);
	});

	it("counts a new game from 0", () => {
		expect(diffTotals([], [total("70", 1200)]).diffs).toEqual([
			{ storeGameId: "70", origin: "steam", minutes: 20 },
		]);
	});

	it("drops changes under a minute and doesn't lose the remainder later", () => {
		expect(diffTotals([total("Min", 3570)], [total("Min", 3599)]).diffs).toEqual([]);
		// 59.5 min → 61 min: 2 minutes, not 1.5 rounded
		expect(diffTotals([total("Min", 3599)], [total("Min", 3660)]).diffs[0].minutes).toBe(2);
	});

	it("returns decreasing totals apart, never as plays", () => {
		const { diffs, decreases } = diffTotals([total("70", 3600)], [total("70", 1200)]);
		expect(diffs).toEqual([]);
		expect(decreases).toEqual([{ storeGameId: "70", origin: "steam", minutes: -40 }]);
	});

	it("ignores games no longer reported", () => {
		expect(diffTotals([total("70", 3600)], [])).toEqual({ diffs: [], decreases: [] });
	});
});

describe("normalizeName", () => {
	it("ignores case, accents, punctuation and trademark signs", () => {
		expect(normalizeName("Clair Obscur : Expédition 33™")).toBe(normalizeName("Clair Obscur: Expedition 33"));
		expect(normalizeName("The Witcher 3: Wild Hunt — Remastered")).toBe("the witcher 3 wild hunt remastered");
	});

	it("drops apostrophes instead of splitting words", () => {
		expect(normalizeName("Baldur's Gate 3")).toBe("baldurs gate 3");
		expect(normalizeName("Baldur’s Gate 3")).toBe("baldurs gate 3");
	});

	it("keeps different games apart", () => {
		expect(normalizeName("Hades II")).not.toBe(normalizeName("Hades"));
	});
});

describe("computeCatchUp", () => {
	it("subtracts the playtime already recorded on the game", () => {
		expect(computeCatchUp(5091, [{ duration: 60 }, { duration: 30 }, {}])).toBe(5001);
	});

	it("never goes below 0", () => {
		expect(computeCatchUp(30, [{ duration: 60 }])).toBe(0);
	});
});

describe("run slots", () => {
	it("gives today's 04:00 once it has passed, yesterday's before", () => {
		expect(lastRunSlot(at("2026-11-14T10:00:00+01:00")).toString()).toBe("2026-11-14T03:00:00Z");
		expect(lastRunSlot(at("2026-11-14T04:00:00+01:00")).toString()).toBe("2026-11-14T03:00:00Z");
		expect(lastRunSlot(at("2026-11-14T03:59:00+01:00")).toString()).toBe("2026-11-13T03:00:00Z");
	});

	it("schedules the next 04:00 Paris time across DST changes", () => {
		expect(nextRunSlot(at("2026-11-14T04:00:00+01:00")).toString()).toBe("2026-11-15T03:00:00Z");
		// spring: the night of the change is 23h long
		expect(nextRunSlot(at("2026-03-28T12:00:00+01:00")).toString()).toBe("2026-03-29T02:00:00Z");
		// autumn: 25h long
		expect(nextRunSlot(at("2026-10-24T12:00:00+02:00")).toString()).toBe("2026-10-25T03:00:00Z");
	});

	it("is due when nothing was fetched since the latest slot", () => {
		const now = at("2026-11-14T10:00:00+01:00");
		expect(isRunDue(now)).toBe(true);
		expect(isRunDue(now, "2026-11-13T03:00:00Z")).toBe(true);
		expect(isRunDue(now, "2026-11-14T03:00:00Z")).toBe(false);
		expect(isRunDue(now, "2026-11-14T08:00:00Z")).toBe(false);
	});
});

describe("findGame", () => {
	const game = (id: string, name: string, storeIds?: Record<string, string>) => ({ id, name, storeIds, plays: [] });
	const brotato = { storeGameId: "1942280", name: "Brotato", origin: "steam" as const, seconds: 60 };

	it("matches the store id first, then the normalized name", () => {
		expect(findGame("steam", brotato, [game("a", "Other", { steam: "1942280" })])?.id).toBe("a");
		expect(findGame("steam", brotato, [game("b", "brotato™")])?.id).toBe("b");
	});

	it("doesn't match by name a game that has another id in this store", () => {
		expect(findGame("steam", brotato, [game("c", "Brotato", { steam: "999" })])).toBeUndefined();
	});
});

describe("buildImportRows", () => {
	it("subtracts the manual plays, not another store's catch-up nor this origin's synced plays twice", () => {
		const games = [
			{
				id: "g",
				name: "Brotato",
				storeIds: { steam: "1942280" },
				plays: [
					{ id: "1", date: "2026-01-01", duration: 30 },
					{ id: "2", date: "1900-01-01", origin: "epic" as const, duration: 500, auto: true },
					{ id: "3", date: "2026-11-14", origin: "steam" as const, duration: 20, auto: true },
				],
			},
		];
		const rows = buildImportRows(
			"steam",
			[{ storeGameId: "1942280", name: "Brotato", origin: "steam", seconds: 100 * 60 }],
			games,
		);
		expect(rows).toEqual([
			{
				storeGameId: "1942280",
				origin: "steam",
				name: "Brotato",
				storeMinutes: 100,
				recordedMinutes: 50,
				catchUp: 50,
				game: { id: "g", name: "Brotato" },
			},
		]);
	});
});
