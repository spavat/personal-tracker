import { describe, expect, it } from "vitest";

import { buildGenre } from "./genre.entity";
import { cleanListening, getDaysBetween, getDaysForAverageCount, sortByDuration, sortByKey } from "./music.entity";

describe("buildGenre", () => {
	it("adds an id and keeps the input", () => {
		const genre = buildGenre({ name: "Rock", genres: ["prog", "metal"] });
		expect(genre).toMatchObject({ name: "Rock", genres: ["prog", "metal"] });
		expect(genre.id).toEqual(expect.any(String));
	});
});

describe("cleanListening", () => {
	it("drops an empty contextTags array", () => {
		expect(cleanListening({ album: "X", contextTags: [] })).toEqual({ album: "X" });
	});
	it("keeps a populated contextTags array", () => {
		expect(cleanListening({ album: "X", contextTags: ["live"] })).toEqual({ album: "X", contextTags: ["live"] });
	});
});

describe("getDaysBetween", () => {
	it("is inclusive of both ends", () => {
		expect(getDaysBetween("2024-01-01", "2024-01-01")).toBe(1);
		expect(getDaysBetween("2024-01-01", "2024-01-10")).toBe(10);
	});
});

describe("getDaysForAverageCount", () => {
	it("counts the full inclusive span for a period entirely in the past", () => {
		expect(getDaysForAverageCount("2020-01-01", "2020-01-05")).toBe(5);
	});
});

describe("sort helpers", () => {
	it("sortByDuration is descending", () => {
		expect([{ duration: 1 }, { duration: 9 }, { duration: 3 }].sort(sortByDuration).map((d) => d.duration)).toEqual(
			[9, 3, 1],
		);
	});
	it("sortByKey is ascending", () => {
		expect([{ key: "c" }, { key: "a" }, { key: "b" }].sort(sortByKey).map((d) => d.key)).toEqual(["a", "b", "c"]);
	});
});
