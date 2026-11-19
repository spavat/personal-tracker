import { describe, expect, it, vi } from "vitest";

import { SportRepository } from "./sport.repository";

function buildRepo() {
	const updateOne = vi.fn();
	const toArray = vi.fn().mockResolvedValue([]);
	const find = vi.fn().mockReturnValue({ toArray });
	const mongo = { db: { collection: () => ({ updateOne, find }) } } as any;
	return { repo: new SportRepository(mongo), updateOne, find };
}

describe("SportRepository.findAll", () => {
	it("keeps the activities of the last day of the period", async () => {
		const { repo, find } = buildRepo();

		await repo.findAll({ from: "2026-09-01", to: "2026-09-30" });

		expect(find.mock.calls[0][0]).toEqual({ date: { $gte: "2026-09-01", $lt: "2026-10-01" } });
	});
});

describe("SportRepository.update", () => {
	it("removes the given fields", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("a1", { name: "X" }, ["comment"]);

		expect(updateOne).toHaveBeenCalledWith(
			{ id: "a1" },
			{ $set: { name: "X" }, $unset: { comment: "" } },
			{ upsert: false },
		);
	});

	it("only sets the fields by default", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("a1", { segments: [] });

		expect(updateOne.mock.calls[0][1]).toEqual({ $set: { segments: [] } });
	});
});
