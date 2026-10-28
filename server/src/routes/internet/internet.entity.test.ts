import { describe, expect, it } from "vitest";

import {
	buildEpisode,
	cleanEpisode,
	convertDurationInMinutes,
	getDetails,
	sortByDuration,
	sortEpisodesDesc,
} from "./internet.entity";

describe("buildEpisode", () => {
	it("adds an id and a created timestamp when none is given", () => {
		const ep = buildEpisode({ name: "Ep 1", duration: 30 });
		expect(ep).toMatchObject({ name: "Ep 1", duration: 30 });
		expect(ep.id).toEqual(expect.any(String));
		expect(ep.created).toEqual(expect.any(String));
	});

	it("keeps an existing created timestamp", () => {
		expect(buildEpisode({ name: "Ep 1", created: "2020-01-01T00:00:00" }).created).toBe("2020-01-01T00:00:00");
	});
});

describe("cleanEpisode", () => {
	it("drops empty tags / contextTags / links", () => {
		expect(cleanEpisode({ name: "x", tags: [], contextTags: [], links: [] })).toEqual({ name: "x" });
	});
	it("keeps populated arrays", () => {
		const ep = { name: "x", tags: ["a"], contextTags: ["b"], links: ["c"] };
		expect(cleanEpisode(ep)).toEqual(ep);
	});
});

describe("sortEpisodesDesc", () => {
	it("orders by date then created, descending", () => {
		const a = { date: "2024-01-01", created: "2024-01-01T08:00:00" } as never;
		const b = { date: "2024-01-01", created: "2024-01-01T20:00:00" } as never;
		const c = { date: "2024-03-01" } as never;
		expect([a, c, b].sort(sortEpisodesDesc)).toEqual([c, b, a]);
	});
});

describe("sortByDuration", () => {
	it("is descending", () => {
		expect([{ duration: 1 }, { duration: 5 }].sort(sortByDuration)).toEqual([{ duration: 5 }, { duration: 1 }]);
	});
});

describe("getDetails", () => {
	it("summarises episode counts, average length and completion rate", () => {
		const program = {
			episodes: [
				{ date: "2024-03-01", duration: 100, durationReal: 50 },
				{ date: "2024-02-01", duration: 100 },
			],
		};
		expect(getDetails(program)).toEqual({
			episodes: 2,
			averageLength: 100,
			completionRate: 75, // (50 + 100) / 200
			lastSeenDate: "2024-03-01", // taken from index 0
		});
	});

	it("avoids dividing by zero for an empty program", () => {
		expect(getDetails({ episodes: [] })).toEqual({
			episodes: 0,
			averageLength: 0,
			completionRate: 0,
			lastSeenDate: "",
		});
	});
});

describe("convertDurationInMinutes", () => {
	it("returns 0 for falsy input", () => {
		expect(convertDurationInMinutes("")).toBe(0);
		expect(convertDurationInMinutes(0)).toBe(0);
	});

	it("treats a large number as seconds and a small number as minutes", () => {
		expect(convertDurationInMinutes(3600)).toBe(60);
		expect(convertDurationInMinutes(45)).toBe(45);
	});

	it("parses mm:ss, rounding 30+ seconds up", () => {
		expect(convertDurationInMinutes("12:00")).toBe(12);
		expect(convertDurationInMinutes("12:29")).toBe(12);
		expect(convertDurationInMinutes("12:30")).toBe(13);
	});

	it("parses hh:mm:ss", () => {
		expect(convertDurationInMinutes("01:30:00")).toBe(90);
	});

	it("parses mm:ss", () => {
		expect(convertDurationInMinutes("01:01")).toBe(1);
	});
});
