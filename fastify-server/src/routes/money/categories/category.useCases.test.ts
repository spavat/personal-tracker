import { describe, expect, it, vi } from "vitest";

import type { CategoryRepository } from "./category.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	CreateCategoryUseCase,
	DeleteCategoryUseCase,
	GetCategoryUseCase,
	ListCategoriesUseCase,
	UpdateCategoryUseCase,
} from "./category.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		findSubCategories: vi.fn().mockResolvedValue([]),
		findTransactionsUsingCategory: vi.fn().mockResolvedValue([]),
		create: vi.fn().mockResolvedValue({ id: 1 }),
		update: vi.fn().mockResolvedValue({ id: 1 }),
		destroy: vi.fn().mockResolvedValue(true),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as CategoryRepository;

describe("category CRUD use cases", () => {
	it("list / create / update delegate through", () => {
		const repo = fakeRepo();
		new ListCategoriesUseCase(asRepo(repo)).execute(asLog(makeLog()));
		new CreateCategoryUseCase(asRepo(repo)).execute({ name: "Food" } as any, asLog(makeLog()));
		new UpdateCategoryUseCase(asRepo(repo)).execute({ id: 1, data: { name: "Food2" } as any }, asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalled();
		expect(repo.create).toHaveBeenCalledWith({ name: "Food" });
		expect(repo.update).toHaveBeenCalledWith(1, { name: "Food2" });
	});

	it("GetCategoryUseCase merges the category with a transactions count", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ id: 1, name: "Food" });
		repo.findTransactionsUsingCategory.mockResolvedValue([{}, {}, {}]);

		expect(await new GetCategoryUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toEqual({
			id: 1,
			name: "Food",
			transactions: 3,
		});
	});
});

describe("DeleteCategoryUseCase", () => {
	it("returns false when sub-categories exist", async () => {
		const repo = fakeRepo();
		repo.findSubCategories.mockResolvedValue([{}]);
		expect(await new DeleteCategoryUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toBe(false);
		expect(repo.destroy).not.toHaveBeenCalled();
	});

	it("returns false when transactions still use the category", async () => {
		const repo = fakeRepo();
		repo.findTransactionsUsingCategory.mockResolvedValue([{}]);
		expect(await new DeleteCategoryUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toBe(false);
	});

	it("returns false when the repository cannot destroy it", async () => {
		const repo = fakeRepo();
		repo.destroy.mockResolvedValue(false);
		expect(await new DeleteCategoryUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toBe(false);
	});

	it("returns true once the category is destroyed", async () => {
		const repo = fakeRepo();
		expect(await new DeleteCategoryUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toBe(true);
		expect(repo.destroy).toHaveBeenCalledWith(1);
	});
});
