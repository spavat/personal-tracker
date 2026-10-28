import { describe, expect, it, vi } from "vitest";

import type { LifespanCategoryRepository } from "./category.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	DeleteLifespanCategoryUseCase,
	ListLifespanCategoriesUseCase,
	SaveLifespanCategoryUseCase,
} from "./category.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		findSubCategories: vi.fn().mockResolvedValue([]),
		findObjectsUsingCategory: vi.fn().mockResolvedValue([]),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		delete: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}

const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as LifespanCategoryRepository;

describe("ListLifespanCategoriesUseCase", () => {
	it("delegates to findAll", () => {
		const repo = fakeRepo();
		new ListLifespanCategoriesUseCase(asRepo(repo)).execute(asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledTimes(1);
	});
});

describe("SaveLifespanCategoryUseCase", () => {
	it("updates when an id is present", async () => {
		const repo = fakeRepo();
		const category = { id: "cat-1", name: "Shoes", parentId: "cat-clothes" };
		await new SaveLifespanCategoryUseCase(asRepo(repo)).execute(category as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("cat-1", category);
		expect(repo.insert).not.toHaveBeenCalled();
	});

	it("refuses a parent among the category's descendants", async () => {
		const repo = fakeRepo();
		repo.findAll.mockResolvedValue([
			{ id: "cat-1", name: "Clothes", parentId: null },
			{ id: "cat-2", name: "Shoes", parentId: "cat-1" },
			{ id: "cat-3", name: "Boots", parentId: "cat-2" },
		]);
		const category = { id: "cat-1", name: "Clothes", parentId: "cat-3" };

		await expect(
			new SaveLifespanCategoryUseCase(asRepo(repo)).execute(category as any, asLog(makeLog())),
		).rejects.toThrow("Une catégorie ne peut pas être rangée sous une de ses sous-catégories");
		expect(repo.update).not.toHaveBeenCalled();
	});

	it("inserts a built category with a fresh id when there is no id", async () => {
		const repo = fakeRepo();
		await new SaveLifespanCategoryUseCase(asRepo(repo)).execute(
			{
				name: "Shoes",
				parentId: null,
			} as any,
			asLog(makeLog()),
		);

		expect(repo.update).not.toHaveBeenCalled();
		expect(repo.insert).toHaveBeenCalledTimes(1);
		expect(repo.insert.mock.calls[0][0]).toMatchObject({ name: "Shoes", parentId: null });
		expect(repo.insert.mock.calls[0][0].id).toEqual(expect.any(String));
	});
});

describe("DeleteLifespanCategoryUseCase", () => {
	it("refuses to delete when sub-categories exist", async () => {
		const repo = fakeRepo();
		repo.findSubCategories.mockResolvedValue([{ id: "sub-1" }]);

		expect(await new DeleteLifespanCategoryUseCase(asRepo(repo)).execute("cat-1", asLog(makeLog()))).toEqual({
			deleted: false,
			reason: "has_children",
		});
		expect(repo.delete).not.toHaveBeenCalled();
	});

	it("refuses to delete when objects still reference the category", async () => {
		const repo = fakeRepo();
		repo.findObjectsUsingCategory.mockResolvedValue([{ id: "obj-1" }]);

		expect(await new DeleteLifespanCategoryUseCase(asRepo(repo)).execute("cat-1", asLog(makeLog()))).toEqual({
			deleted: false,
			reason: "in_use",
		});
		expect(repo.delete).not.toHaveBeenCalled();
	});

	it("deletes the category once it has no children and no objects", async () => {
		const repo = fakeRepo();
		expect(await new DeleteLifespanCategoryUseCase(asRepo(repo)).execute("cat-1", asLog(makeLog()))).toEqual({
			deleted: true,
		});
		expect(repo.delete).toHaveBeenCalledWith("cat-1");
	});
});
