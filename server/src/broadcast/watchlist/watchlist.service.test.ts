import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { BroadcastRepository } from "../broadcast.repository.js";
import { WatchlistService } from "./watchlist.service.js";

describe("WatchlistService", () => {
	it("lists the planned episodes oldest release first, those without release date last", async () => {
		const planned = (id: string, releaseDate?: string) => ({
			programId: "p1",
			programName: "Prog",
			episode: { id, name: id, releaseDate, views: [] },
		});
		const repo = {
			findWatchlist: vi
				.fn()
				.mockResolvedValue([planned("undated"), planned("late", "2026-10-02"), planned("early", "2026-01-05")]),
		};
		const ref = await Test.createTestingModule({
			providers: [WatchlistService, { provide: BroadcastRepository, useValue: repo }],
		}).compile();

		const list = await ref.get(WatchlistService).plannedEpisodes();

		expect(list.map(({ episode }) => episode.id)).toEqual(["early", "late", "undated"]);
	});
});
