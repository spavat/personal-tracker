import { describe, expect, it, vi } from "vitest";

import { ContextTagRepository } from "./context-tag.repository";

describe("ContextTagRepository.findAll", () => {
	it("sorts the main tags by name, in French", async () => {
		const find = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
		const mongo = { db: { collection: () => ({ find }) } } as any;

		await new ContextTagRepository(mongo).findAll();

		expect(find).toHaveBeenCalledWith(
			{},
			{ projection: { _id: 0 }, sort: { name: 1 }, collation: { locale: "fr" } },
		);
	});
});
