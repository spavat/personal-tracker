import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../common/errors.js";
import { LifespanCategoriesRepository } from "./categories.repository.js";
import { LifespanCategoriesService } from "./categories.service.js";

describe("LifespanCategoriesService", () => {
	let service: LifespanCategoriesService;
	const repo = {
		findAll: vi.fn(),
		findSubCategories: vi.fn(),
		findObjectsUsingCategory: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		repo.findAll.mockResolvedValue([]);
		repo.findSubCategories.mockResolvedValue([]);
		repo.findObjectsUsingCategory.mockResolvedValue([]);
		const ref = await Test.createTestingModule({
			providers: [LifespanCategoriesService, { provide: LifespanCategoriesRepository, useValue: repo }],
		}).compile();
		service = ref.get(LifespanCategoriesService);
	});

	describe("save", () => {
		it("updates when an id is present", async () => {
			const category = { id: "cat-1", name: "Shoes", parentId: "cat-clothes" };

			await service.save(category);

			expect(repo.update).toHaveBeenCalledWith("cat-1", category);
			expect(repo.insert).not.toHaveBeenCalled();
		});

		it("refuses a parent among the category's descendants", async () => {
			repo.findAll.mockResolvedValue([
				{ id: "cat-1", name: "Clothes", parentId: null },
				{ id: "cat-2", name: "Shoes", parentId: "cat-1" },
				{ id: "cat-3", name: "Boots", parentId: "cat-2" },
			]);

			await expect(service.save({ id: "cat-1", name: "Clothes", parentId: "cat-3" })).rejects.toBeInstanceOf(
				ConflictError,
			);
			expect(repo.update).not.toHaveBeenCalled();
		});

		it("inserts a built category with a fresh id when there is no id", async () => {
			await service.save({ name: "Shoes", parentId: null });

			expect(repo.update).not.toHaveBeenCalled();
			expect(repo.insert.mock.calls[0][0]).toMatchObject({ name: "Shoes", parentId: null });
			expect(repo.insert.mock.calls[0][0].id).toEqual(expect.any(String));
		});
	});

	describe("delete", () => {
		it("refuses to delete when sub-categories exist", async () => {
			repo.findSubCategories.mockResolvedValue([{ id: "sub-1" }]);

			expect(await service.delete("cat-1")).toEqual({ deleted: false, reason: "has_children" });
			expect(repo.delete).not.toHaveBeenCalled();
		});

		it("refuses to delete when objects still reference the category", async () => {
			repo.findObjectsUsingCategory.mockResolvedValue([{ id: "obj-1" }]);

			expect(await service.delete("cat-1")).toEqual({ deleted: false, reason: "in_use" });
			expect(repo.delete).not.toHaveBeenCalled();
		});

		it("deletes the category once it has no children and no objects", async () => {
			expect(await service.delete("cat-1")).toEqual({ deleted: true });
			expect(repo.delete).toHaveBeenCalledWith("cat-1");
		});
	});
});
