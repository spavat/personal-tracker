import { describe, expect, it, vi } from "vitest";

import { LifespanObjectRepository } from "./object.repository";

function buildRepo() {
	const updateOne = vi.fn();
	const aggregate = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
	const mongo = { db: { collection: () => ({ updateOne, aggregate }) } } as any;
	return { repo: new LifespanObjectRepository(mongo), updateOne, aggregate };
}

describe("LifespanObjectRepository", () => {
	it("removes the object fields given", async () => {
		const { repo, updateOne } = buildRepo();
		await repo.update("o1", { name: "X" }, ["description"]);
		expect(updateOne.mock.calls[0][1]).toEqual({ $set: { name: "X" }, $unset: { description: "" } });
	});

	it("removes the event fields given", async () => {
		const { repo, updateOne } = buildRepo();
		await repo.updateEvent("o1", { id: "e1", type: "note" }, ["cause", "comment"]);
		expect(updateOne).toHaveBeenCalledWith(
			{ id: "o1" },
			{
				$set: { "events.$[element].id": "e1", "events.$[element].type": "note" },
				$unset: { "events.$[element].cause": "", "events.$[element].comment": "" },
			},
			{ arrayFilters: [{ "element.id": "e1" }] },
		);
	});

	it("searches the text as typed, not as a regex", async () => {
		const { repo, aggregate } = buildRepo();
		await repo.findAll({ search: "(a.b", sortField: "name", sortDirection: "asc" });
		const { name } = aggregate.mock.calls[0][0][0].$match;
		expect(name.test("x(a.b")).toBe(true);
		expect(name.test("xaab")).toBe(false);
	});
});
