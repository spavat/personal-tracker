import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "../../common/errors.js";
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

	describe("create / update", () => {
		it("updates the category of the path", async () => {
			const category = { name: "Shoes", parentId: "cat-clothes" };
			repo.update.mockResolvedValue({ id: "cat-1", ...category });

			expect(await service.update("cat-1", category)).toEqual({ id: "cat-1", ...category });

			expect(repo.update).toHaveBeenCalledWith("cat-1", category);
			expect(repo.insert).not.toHaveBeenCalled();
		});

		it("refuses a parent among the category's descendants", async () => {
			repo.findAll.mockResolvedValue([
				{ id: "cat-1", name: "Clothes", parentId: null },
				{ id: "cat-2", name: "Shoes", parentId: "cat-1" },
				{ id: "cat-3", name: "Boots", parentId: "cat-2" },
			]);

			await expect(service.update("cat-1", { name: "Clothes", parentId: "cat-3" })).rejects.toBeInstanceOf(
				ConflictError,
			);
			expect(repo.update).not.toHaveBeenCalled();
		});

		it("answers NotFoundError for an unknown category", async () => {
			repo.update.mockResolvedValue(null);
			await expect(service.update("cat-1", { name: "Shoes", parentId: null })).rejects.toBeInstanceOf(
				NotFoundError,
			);
		});

		it("inserts a built category with a fresh id", async () => {
			await service.create({ name: "Shoes", parentId: null });

			expect(repo.update).not.toHaveBeenCalled();
			expect(repo.insert.mock.calls[0][0]).toMatchObject({ name: "Shoes", parentId: null });
			expect(repo.insert.mock.calls[0][0].id).toEqual(expect.any(String));
		});
	});

	describe("delete", () => {
		it("refuses to delete when sub-categories exist", async () => {
			repo.findSubCategories.mockResolvedValue([{ id: "sub-1" }]);

			await expect(service.delete("cat-1")).rejects.toThrow(/sous-catégories/);
			expect(repo.delete).not.toHaveBeenCalled();
		});

		it("refuses to delete when objects still reference the category", async () => {
			repo.findObjectsUsingCategory.mockResolvedValue([{ id: "obj-1" }]);

			await expect(service.delete("cat-1")).rejects.toThrow(/objets/);
			expect(repo.delete).not.toHaveBeenCalled();
		});

		it("deletes the category once it has no children and no objects", async () => {
			repo.delete.mockResolvedValue(true);
			await expect(service.delete("cat-1")).resolves.toBeUndefined();
			expect(repo.delete).toHaveBeenCalledWith("cat-1");
		});
	});
});
