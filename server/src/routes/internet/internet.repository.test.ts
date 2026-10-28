import { describe, expect, it, vi } from "vitest";

import { InternetRepository } from "./internet.repository";

function buildRepo() {
	const updateOne = vi.fn();
	const mongo = { db: { collection: () => ({ updateOne }) } } as any;
	return { repo: new InternetRepository(mongo), updateOne };
}

describe("InternetRepository.updateEpisode", () => {
	it("unsets the optional fields missing from the payload", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.updateEpisode("p1", { id: "e1", name: "Ep", tags: ["a"] });

		expect(updateOne).toHaveBeenCalledWith(
			{ id: "p1" },
			{
				$set: {
					"episodes.$[element].id": "e1",
					"episodes.$[element].name": "Ep",
					"episodes.$[element].tags": ["a"],
				},
				$unset: { "episodes.$[element].durationReal": "", "episodes.$[element].contextTags": "" },
			},
			{ arrayFilters: [{ "element.id": "e1" }] },
		);
	});

	it("doesn't unset anything when every optional field is sent", async () => {
		const { repo, updateOne } = buildRepo();

		await repo.updateEpisode("p1", { id: "e1", durationReal: 10, tags: ["a"], contextTags: ["b"] });

		expect(updateOne.mock.calls[0][1]).not.toHaveProperty("$unset");
	});
});
