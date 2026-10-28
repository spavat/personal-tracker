import { describe, expect, it } from "vitest";

import { buildPlay, cleanGame, sortPlaysDesc as sortPlaysDescStrict } from "./game.entity";

// the fixtures below only carry the fields sortPlaysDesc actually reads
const sortPlaysDesc = sortPlaysDescStrict as (
	a: { date: string; created?: string },
	b: { date: string; created?: string },
) => number;

describe("buildPlay", () => {
	it("keeps the input fields and stamps a fresh id and created timestamp", () => {
		const play = buildPlay({ date: "2024-06-01", comment: "great", duration: 120 });

		expect(play).toMatchObject({ date: "2024-06-01", comment: "great", duration: 120 });
		expect(play.id).toEqual(expect.any(String));
		expect(play.created).toEqual(expect.any(String));
	});

	it("regenerates the id even when the input already has one", () => {
		const play = buildPlay({ id: "provided-id", date: "2024-06-01" } as never);
		expect(play.id).not.toBe("provided-id");
	});

	it("returns a different id on each call", () => {
		expect(buildPlay({ date: "2024-06-01" } as never).id).not.toBe(buildPlay({ date: "2024-06-01" } as never).id);
	});
});

describe("cleanGame", () => {
	it("drops an empty links array", () => {
		expect(cleanGame({ name: "Celeste", links: [] })).toEqual({ name: "Celeste" });
	});

	it("leaves a populated links array untouched", () => {
		const game = { name: "Celeste", links: [{ name: "site", link: "https://x" }] };
		expect(cleanGame(game)).toEqual(game);
	});

	it("is a no-op when links is absent", () => {
		expect(cleanGame({ name: "Celeste" })).toEqual({ name: "Celeste" });
	});
});

describe("sortPlaysDesc", () => {
	it("orders by date descending", () => {
		const plays = [{ date: "2024-01-01" }, { date: "2024-03-01" }, { date: "2024-02-01" }];
		expect([...plays].sort(sortPlaysDesc).map((p) => p.date)).toEqual(["2024-03-01", "2024-02-01", "2024-01-01"]);
	});

	it("breaks ties on created descending", () => {
		const a = { date: "2024-01-01", created: "2024-01-01T08:00:00" };
		const b = { date: "2024-01-01", created: "2024-01-01T20:00:00" };
		expect([a, b].sort(sortPlaysDesc)).toEqual([b, a]);
	});

	it("tolerates a missing created on a tie", () => {
		const a = { date: "2024-01-01" };
		const b = { date: "2024-01-01", created: "2024-01-01T20:00:00" };
		expect([a, b].sort(sortPlaysDesc)).toEqual([b, a]);
	});
});
