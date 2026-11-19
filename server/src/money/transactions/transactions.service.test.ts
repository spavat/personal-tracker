import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../common/errors.js";
import { TransactionsRepository } from "./transactions.repository.js";
import { TransactionsService } from "./transactions.service.js";

const TX = { tx: true }; // the transaction handle given to the runInTransaction callback

describe("TransactionsService", () => {
	let service: TransactionsService;
	const repo = {
		findAll: vi.fn(),
		findById: vi.fn(),
		findByIdWithChildren: vi.fn(),
		create: vi.fn(),
		createTags: vi.fn(),
		deleteTags: vi.fn(),
		update: vi.fn(),
		destroy: vi.fn(),
		runInTransaction: vi.fn(),
		findSubCategories: vi.fn(),
		findDirectTransactionsByAccount: vi.fn(),
		findSubTransactionsByAccount: vi.fn(),
		findDirectTransactionsByCategory: vi.fn(),
		findSubTransactionsByCategory: vi.fn(),
		findDirectTransactionsByTag: vi.fn(),
		findSubTransactionsByTag: vi.fn(),
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		repo.runInTransaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(TX));
		const ref = await Test.createTestingModule({
			providers: [TransactionsService, { provide: TransactionsRepository, useValue: repo }],
		}).compile();
		service = ref.get(TransactionsService);
	});

	describe("list", () => {
		it("sorts on the consideration date when asked, on the date otherwise", () => {
			service.list({ dateOrder: "considerationDate", searchText: "rent" });
			service.list({ dateOrder: "anything" });

			expect(repo.findAll.mock.calls[0][0]).toMatchObject({ dateField: "considerationDate", searchText: "rent" });
			expect(repo.findAll.mock.calls[1][0]).toMatchObject({ dateField: "date" });
		});
	});

	describe("get", () => {
		it("rejects with NotFoundError for an unknown transaction", async () => {
			repo.findById.mockResolvedValue(undefined);
			await expect(service.get(1)).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("create", () => {
		it("creates the parent, its children with the parent's date, and the tag links", async () => {
			repo.create.mockResolvedValueOnce({ id: 1, date: "2024-06-01" }).mockResolvedValueOnce({ id: 2 });

			await service.create({
				name: "Shop",
				categoryId: 0,
				paymentTypeId: 3,
				tags: [{ id: 7 }],
				children: [{ name: "Part", categoryId: 5, paymentTypeId: 0, tags: [{ id: 8 }] }],
			} as never);

			expect(repo.create.mock.calls[0][0]).toMatchObject({ name: "Shop", categoryId: null, paymentTypeId: 3 });
			expect(repo.create.mock.calls[1][0]).toMatchObject({
				name: "Part",
				categoryId: 5,
				paymentTypeId: null,
				date: "2024-06-01",
				parentId: 1,
			});
			expect(repo.createTags).toHaveBeenCalledWith([{ transactionId: 2, tagId: 8 }]);
			expect(repo.createTags).toHaveBeenCalledWith([{ transactionId: 1, tagId: 7 }]);
		});
	});

	describe("update", () => {
		it("only updates the parent for a quick update", async () => {
			repo.findByIdWithChildren.mockResolvedValue({ id: 1, children: [{ id: 2 }] });

			await service.update(1, "quick", { name: "New", categoryId: 0, paymentTypeId: 0 } as never);

			expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: "New", categoryId: null }));
			expect(repo.runInTransaction).not.toHaveBeenCalled();
			expect(repo.deleteTags).not.toHaveBeenCalled();
		});

		it("rewrites tags and children inside one database transaction", async () => {
			repo.findByIdWithChildren.mockResolvedValue({
				id: 1,
				date: "2024-06-01",
				children: [{ id: 2 }, { id: 3 }],
			});
			repo.create.mockResolvedValue({ id: 4 });

			await service.update(1, "full", {
				name: "Shop",
				categoryId: 1,
				paymentTypeId: 1,
				tags: [{ id: 7 }],
				children: [
					{ id: 2, name: "kept", tags: [{ id: 8 }] }, // 3 removed
					{ name: "new", tags: [] },
				],
			} as never);

			// every write goes through the transaction handle
			expect(repo.deleteTags).toHaveBeenCalledWith([1, 2, 3], TX);
			expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: "Shop" }), TX);
			expect(repo.createTags).toHaveBeenCalledWith([{ transactionId: 1, tagId: 7 }], TX);
			expect(repo.update).toHaveBeenCalledWith(
				2,
				expect.objectContaining({ name: "kept", date: "2024-06-01", parentId: 1 }),
				TX,
			);
			expect(repo.createTags).toHaveBeenCalledWith([{ transactionId: 2, tagId: 8 }], TX);
			expect(repo.destroy).toHaveBeenCalledWith(3, TX);
			expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ name: "new", parentId: 1 }), TX);
			expect(repo.destroy).not.toHaveBeenCalledWith(2, TX);
		});

		it("stores a child's 0 category / payment type as null, as on create", async () => {
			repo.findByIdWithChildren.mockResolvedValue({ id: 1, children: [{ id: 2 }] });
			repo.create.mockResolvedValue({ id: 3 });

			await service.update(1, "full", {
				categoryId: 1,
				paymentTypeId: 1,
				children: [
					{ id: 2, categoryId: 0, paymentTypeId: 4 },
					{ categoryId: 5, paymentTypeId: 0 },
				],
			} as never);

			expect(repo.update).toHaveBeenCalledWith(
				2,
				expect.objectContaining({ categoryId: null, paymentTypeId: 4 }),
				TX,
			);
			expect(repo.create).toHaveBeenCalledWith(
				expect.objectContaining({ categoryId: 5, paymentTypeId: null }),
				TX,
			);
		});

		it("rejects with NotFoundError for an unknown transaction", async () => {
			repo.findByIdWithChildren.mockResolvedValue(undefined);
			await expect(service.update(1, "quick", {} as never)).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("delete", () => {
		it("deletes the tag links, the children and the parent in one transaction", async () => {
			repo.findByIdWithChildren.mockResolvedValue({ id: 1, children: [{ id: 2 }] });

			await service.delete(1);

			expect(repo.deleteTags).toHaveBeenCalledWith([1, 2], TX);
			expect(repo.destroy.mock.calls).toEqual([
				[2, TX],
				[1, TX],
			]);
		});

		it("rejects with NotFoundError for an unknown transaction", async () => {
			repo.findByIdWithChildren.mockResolvedValue(undefined);
			await expect(service.delete(1)).rejects.toBeInstanceOf(NotFoundError);
			expect(repo.runInTransaction).not.toHaveBeenCalled();
		});
	});

	describe("list by relation", () => {
		it("expands the sub-categories before querying", async () => {
			repo.findSubCategories.mockResolvedValue([{ id: 6 }, { id: 7 }]);
			repo.findDirectTransactionsByCategory.mockResolvedValue([{ date: "2024-02-01" }]);
			repo.findSubTransactionsByCategory.mockResolvedValue([{ date: "2024-01-01" }]);

			const result = await service.listByCategory(5);

			expect(repo.findDirectTransactionsByCategory).toHaveBeenCalledWith([5, 6, 7]);
			expect(repo.findSubTransactionsByCategory).toHaveBeenCalledWith([5, 6, 7]);
			expect(result.map((t) => t.date)).toEqual(["2024-01-01", "2024-02-01"]);
		});
	});
});
