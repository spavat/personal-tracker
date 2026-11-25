import { describe, expect, it } from "vitest";

import {
	convertDurationInMinutes,
	type EpisodeDoc,
	getDetails,
	getEpisodeTags,
	sortByDuration,
	sortEpisodesDesc,
	sortViewsDesc,
} from "./broadcast.entity.js";

const episode = (id: string, duration: number, views: EpisodeDoc["views"]): EpisodeDoc => ({
	id,
	name: id,
	duration,
	type: "podcast",
	credits: [],
	views,
});

describe("getEpisodeTags", () => {
	it("merges the program tags with the episode ones", () => {
		expect(getEpisodeTags(["news"], { tags: ["special"] })).toEqual(["news", "special"]);
	});
	it("leaves out the ignored program tags", () => {
		expect(getEpisodeTags(["news", "tech"], { tags: ["special"], ignoredTags: ["news"] })).toEqual([
			"tech",
			"special",
		]);
	});
	it("keeps each tag once", () => {
		expect(getEpisodeTags(["news"], { tags: ["news"] })).toEqual(["news"]);
	});
	it("returns no tag when nothing is set", () => {
		expect(getEpisodeTags(undefined, {})).toEqual([]);
		expect(getEpisodeTags(["news"], { ignoredTags: ["news"] })).toEqual([]);
	});
});

describe("sortViewsDesc", () => {
	it("orders by date then created, descending", () => {
		const a = { date: "2024-01-01", created: "2024-01-01T08:00:00" };
		const b = { date: "2024-01-01", created: "2024-01-01T20:00:00" };
		const c = { date: "2024-03-01" };
		expect([a, c, b].sort(sortViewsDesc)).toEqual([c, b, a]);
	});
});

describe("sortEpisodesDesc", () => {
	it("orders by the latest view, an episode without view last", () => {
		const old = episode("old", 10, [{ id: "v1", date: "2024-01-01" }]);
		const relistened = episode("relistened", 10, [
			{ id: "v2", date: "2023-12-01" },
			{ id: "v3", date: "2024-02-01" },
		]);
		const unseen = episode("unseen", 10, []);
		expect([unseen, old, relistened].sort(sortEpisodesDesc).map(({ id }) => id)).toEqual([
			"relistened",
			"old",
			"unseen",
		]);
	});
});

describe("sortByDuration", () => {
	it("is descending", () => {
		expect([{ duration: 1 }, { duration: 5 }].sort(sortByDuration)).toEqual([{ duration: 5 }, { duration: 1 }]);
	});
});

describe("getDetails", () => {
	it("counts the views: an episode watched twice counts twice; the releases are the episodes", () => {
		const program = {
			episodes: [
				episode("e1", 100, [
					{ id: "v1", date: "2024-01-01", duration: 50 },
					{ id: "v2", date: "2024-03-01" },
				]),
				episode("e2", 100, [{ id: "v3", date: "2024-02-01" }]),
				// imported, not watched yet
				episode("e3", 100, []),
			],
		};
		expect(getDetails(program)).toEqual({
			episodes: 3,
			averageLength: 100,
			completionRate: 83, // (50 + 100 + 100) / 300
			lastSeenDate: "2024-03-01",
			releases: 3,
			watched: 2,
			skipped: 0,
		});
	});

	it("avoids dividing by zero for an empty program", () => {
		expect(getDetails({ episodes: [] })).toEqual({
			episodes: 0,
			averageLength: 0,
			completionRate: 0,
			lastSeenDate: "",
			releases: 0,
			watched: 0,
			skipped: 0,
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
