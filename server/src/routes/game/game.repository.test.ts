import { describe, expect, it, vi } from "vitest";

import { GameRepository } from "./game.repository";

function buildRepo() {
	const updateOne = vi.fn();
	const mongo = { db: { collection: () => ({ updateOne }) } } as any;
	return { repo: new GameRepository(mongo), updateOne };
}

describe("GameRepository.update", () => {
	it("removes the links, store ids and pictures missing from the payload", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("g1", { name: "X" });

		expect(updateOne).toHaveBeenCalledWith(
			{ id: "g1" },
			{ $set: { name: "X" }, $unset: { links: "", storeIds: "", capsule: "", header: "" } },
			{ upsert: false },
		);
	});

	it("doesn't unset the lists sent", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("g1", {
			name: "X",
			links: [{ name: "l", link: "https://l.example.com" }],
			storeIds: { steam: "1942280" },
			capsule: "personal-tracker/game/g1.capsule.avif",
			header: "personal-tracker/game/g1.header.avif",
		});

		expect(updateOne.mock.calls[0][1]).not.toHaveProperty("$unset");
	});
});

describe("GameRepository store sync", () => {
	const play = { id: "p1", date: "2026-11-14", origin: "steam" as const, duration: 30, auto: true as const };

	it("adds the minutes to the day's auto play when there is one", async () => {
		const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
		const repo = new GameRepository({ db: { collection: () => ({ updateOne }) } } as any);

		await repo.addToAutoPlay("g1", play);

		expect(updateOne).toHaveBeenCalledTimes(1);
		expect(updateOne).toHaveBeenCalledWith(
			{
				id: "g1",
				plays: { $elemMatch: { date: "2026-11-14", origin: "steam", auto: true, catchUp: { $exists: false } } },
			},
			{ $inc: { "plays.$.duration": 30 } },
		);
	});

	it("adds the play when the day has no auto play yet", async () => {
		const updateOne = vi.fn().mockResolvedValueOnce({ matchedCount: 0 }).mockResolvedValue({ matchedCount: 1 });
		const repo = new GameRepository({ db: { collection: () => ({ updateOne }) } } as any);

		await repo.addToAutoPlay("g1", play);

		expect(updateOne).toHaveBeenLastCalledWith({ id: "g1" }, { $push: { plays: play } });
	});

	it("replaces the origin's catch-up whatever its date, or only removes it", async () => {
		const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
		const repo = new GameRepository({ db: { collection: () => ({ updateOne }) } } as any);
		const catchUp = { ...play, date: "2021-12-11", catchUp: "last-session" as const };

		await repo.replaceCatchUp("g1", "steam", catchUp);
		expect(updateOne).toHaveBeenNthCalledWith(
			1,
			{ id: "g1" },
			{ $pull: { plays: { origin: "steam", auto: true, catchUp: { $exists: true } } } },
		);
		expect(updateOne).toHaveBeenNthCalledWith(2, { id: "g1" }, { $push: { plays: catchUp } });

		updateOne.mockClear();
		await repo.replaceCatchUp("g1", "steam");
		expect(updateOne).toHaveBeenCalledTimes(1);
	});

	it("leaves the catch-ups out of the period views", async () => {
		const aggregate = vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) }));
		const repo = new GameRepository({ db: { collection: () => ({ aggregate }) } } as any);

		await repo.findPlaysInRange({ from: "2021-01-01", to: "2021-12-31" });

		const [match, filter] = (aggregate.mock.calls[0] as any)[0];
		expect(match.$match.plays.$elemMatch.catchUp).toEqual({ $exists: false });
		expect(filter.$set.plays.$filter.cond.$and).toContainEqual({ $eq: [{ $type: "$$play.catchUp" }, "missing"] });
	});

	it("removes only the auto plays of that day and those origins", async () => {
		const updateMany = vi.fn();
		const repo = new GameRepository({ db: { collection: () => ({ updateMany }) } } as any);

		await repo.deleteAutoPlays("2026-11-14", ["steam", "steam-deck"]);

		expect(updateMany).toHaveBeenCalledWith(
			{},
			{
				$pull: {
					plays: {
						date: "2026-11-14",
						origin: { $in: ["steam", "steam-deck"] },
						auto: true,
						catchUp: { $exists: false },
					},
				},
			},
		);
	});
});
