import { describe, expect, it, vi } from "vitest";

import { MusicRepository } from "./music.repository";

function buildRepo() {
	const updateOne = vi.fn();
	const mongo = { db: { collection: () => ({ updateOne }) } } as any;
	return { repo: new MusicRepository(mongo), updateOne };
}

describe("MusicRepository.update", () => {
	it("removes the context tags missing from the payload", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("l1", { album: "Kid A" });

		expect(updateOne).toHaveBeenCalledWith(
			{ id: "l1" },
			{ $set: { album: "Kid A" }, $unset: { contextTags: "" } },
			{ upsert: false },
		);
	});

	it("keeps the context tags sent", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.update("l1", { album: "Kid A", contextTags: ["train"] });

		expect(updateOne.mock.calls[0][1]).toEqual({ $set: { album: "Kid A", contextTags: ["train"] } });
	});
});
