import { describe, expect, it, vi } from "vitest";

import { runInRequestContext, setViewerIsOwner } from "../../request-context";
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

describe("InternetRepository private programs", () => {
	function buildReadRepo() {
		const findOne = vi.fn();
		const aggregate = vi.fn(() => ({ toArray: () => [] }));
		const mongo = { db: { collection: () => ({ findOne, aggregate }) } } as any;
		return { repo: new InternetRepository(mongo), findOne, aggregate };
	}
	const listFilters = { search: "", sortField: "name", sortDirection: "asc" };

	it("hides private programs from anonymous visitors", () => {
		const { repo, findOne, aggregate } = buildReadRepo();

		runInRequestContext(() => {
			repo.findById("p1");
			repo.findAll(listFilters);
		});

		expect(findOne).toHaveBeenCalledWith({ private: { $ne: true }, id: "p1" });
		expect((aggregate.mock.calls[0] as any)[0][0].$match).toHaveProperty("private", { $ne: true });
	});

	it("shows every program to the owner", () => {
		const { repo, findOne, aggregate } = buildReadRepo();

		runInRequestContext(() => {
			setViewerIsOwner(true);
			repo.findById("p1");
			repo.findAll(listFilters);
		});

		expect(findOne).toHaveBeenCalledWith({ id: "p1" });
		expect((aggregate.mock.calls[0] as any)[0][0].$match).not.toHaveProperty("private");
	});
});
