import { describe, expect, it, vi } from "vitest";

import type { ContextTagRepository } from "./context-tag.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import { DeleteContextTagUseCase, ListContextTagsUseCase, SaveContextTagUseCase } from "./context-tag.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		delete: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}

const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as ContextTagRepository;

describe("ListContextTagsUseCase", () => {
	it("delegates to findAll", () => {
		const repo = fakeRepo();
		new ListContextTagsUseCase(asRepo(repo)).execute(asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledTimes(1);
	});
});

describe("SaveContextTagUseCase", () => {
	it("updates when an id is present", () => {
		const repo = fakeRepo();
		const tag = { id: "tag-1", name: "Genre", tags: ["scifi"] };
		new SaveContextTagUseCase(asRepo(repo)).execute(tag as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("tag-1", tag);
		expect(repo.insert).not.toHaveBeenCalled();
	});

	it("inserts a built tag with a fresh id when there is no id", () => {
		const repo = fakeRepo();
		new SaveContextTagUseCase(asRepo(repo)).execute({ name: "Genre", tags: ["scifi"] } as any, asLog(makeLog()));

		expect(repo.update).not.toHaveBeenCalled();
		expect(repo.insert).toHaveBeenCalledTimes(1);
		expect(repo.insert.mock.calls[0][0]).toMatchObject({ name: "Genre", tags: ["scifi"] });
		expect(repo.insert.mock.calls[0][0].id).toEqual(expect.any(String));
	});
});

describe("DeleteContextTagUseCase", () => {
	it("delegates to delete by id", () => {
		const repo = fakeRepo();
		new DeleteContextTagUseCase(asRepo(repo)).execute("tag-1", asLog(makeLog()));
		expect(repo.delete).toHaveBeenCalledWith("tag-1");
	});
});
