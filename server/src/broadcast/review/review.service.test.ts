import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { BroadcastRepository } from "../broadcast.repository.js";
import { ReviewService } from "./review.service.js";

describe("ReviewService", () => {
	it("lists the episodes without any tag (own or kept from the program), watched last first", async () => {
		const repo = {
			findAllWithEpisodes: vi.fn().mockResolvedValue([
				{
					id: "p1",
					name: "Tagged program",
					tags: ["news"],
					episodes: [{ id: "e1", views: [{ id: "v1", date: "2024-01-01" }] }],
				},
				{
					id: "p2",
					name: "Bare",
					episodes: [
						{ id: "e2", views: [{ id: "v2", date: "2024-01-01" }] },
						{ id: "e3", views: [{ id: "v3", date: "2024-02-01" }] },
						{ id: "e4", views: [{ id: "v4", date: "2024-03-01" }], tags: ["own"] },
						// a release of a catalog never watched
						{ id: "e6", views: [] },
					],
				},
				{
					id: "p3",
					name: "All ignored",
					tags: ["news"],
					episodes: [{ id: "e5", views: [{ id: "v5", date: "2024-01-15" }], ignoredTags: ["news"] }],
				},
			]),
		};
		const ref = await Test.createTestingModule({
			providers: [ReviewService, { provide: BroadcastRepository, useValue: repo }],
		}).compile();

		const episodes = await ref.get(ReviewService).untaggedEpisodes();

		expect(episodes.map(({ programId, episode }) => [programId, episode.id])).toEqual([
			["p2", "e3"],
			["p3", "e5"],
			["p2", "e2"],
		]);
	});
});
