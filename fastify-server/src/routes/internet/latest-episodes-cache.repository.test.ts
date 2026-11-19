import { describe, expect, it } from "vitest";

import { LatestEpisodesCacheRepository } from "./latest-episodes-cache.repository";

describe("LatestEpisodesCacheRepository", () => {
	it("stores and returns a value per program id", () => {
		const cache = new LatestEpisodesCacheRepository();
		const value = { dateTimeUtc: "2024-01-01T00:00:00", type: "rss", latestEpisodes: [] } as never;

		expect(cache.get("p1")).toBeUndefined();
		cache.set("p1", value);
		expect(cache.get("p1")).toBe(value);
		expect(cache.get("p2")).toBeUndefined();
	});
});
