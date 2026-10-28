import { describe, expect, it, vi } from "vitest";

import { GameRepository } from "./game.repository";

function buildRepo() {
	const updateOne = vi.fn();
	const mongo = { db: { collection: () => ({ updateOne }) } } as any;
	return { repo: new GameRepository(mongo), updateOne };
}

describe("GameRepository.update", () => {
	it("removes the links missing from the payload", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("g1", { name: "X" });

		expect(updateOne).toHaveBeenCalledWith(
			{ id: "g1" },
			{ $set: { name: "X" }, $unset: { links: "" } },
			{ upsert: false },
		);
	});

	it("doesn't unset the lists sent", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("g1", { name: "X", links: [{ name: "l", link: "https://l.example.com" }] });

		expect(updateOne.mock.calls[0][1]).not.toHaveProperty("$unset");
	});
});
