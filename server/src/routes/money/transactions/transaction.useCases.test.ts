import { describe, expect, it, vi } from "vitest";

import type { TransactionRepository } from "./transaction.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	CreateTransactionUseCase,
	DeleteTransactionUseCase,
	GetTransactionUseCase,
	ListTransactionsByAccountUseCase,
	ListTransactionsByCategoryUseCase,
	ListTransactionsByTagUseCase,
	ListTransactionsUseCase,
} from "./transaction.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		findByIdWithChildren: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue({ id: 100, date: "2024-01-01" }),
		bulkCreateTags: vi.fn().mockResolvedValue(undefined),
		updateInstance: vi.fn().mockResolvedValue(undefined),
		destroyInstance: vi.fn().mockResolvedValue(1),
		deleteTransactionTags: vi.fn().mockResolvedValue(undefined),
		runInTransaction: vi.fn(),
		findSubCategories: vi.fn().mockResolvedValue([]),
		findDirectTransactionsByAccount: vi.fn().mockResolvedValue([]),
		findSubTransactionsByAccount: vi.fn().mockResolvedValue([]),
		findDirectTransactionsByCategory: vi.fn().mockResolvedValue([]),
		findSubTransactionsByCategory: vi.fn().mockResolvedValue([]),
		findDirectTransactionsByTag: vi.fn().mockResolvedValue([]),
		findSubTransactionsByTag: vi.fn().mockResolvedValue([]),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as TransactionRepository;

describe("ListTransactionsUseCase", () => {
	it("maps dateOrder to a dateField and forwards the filters", () => {
		const repo = fakeRepo();
		new ListTransactionsUseCase(asRepo(repo)).execute(
			{
				from: "2024-01-01",
				to: "2024-12-31",
				searchText: "rent",
				dateOrder: "considerationDate",
			},
			asLog(makeLog()),
		);
		expect(repo.findAll).toHaveBeenCalledWith({
			searchText: "rent",
			from: "2024-01-01",
			to: "2024-12-31",
			dateField: "considerationDate",
		});
	});

	it("falls back to the plain date field for any other dateOrder", () => {
		const repo = fakeRepo();
		new ListTransactionsUseCase(asRepo(repo)).execute(
			{
				from: "a",
				to: "b",
				searchText: "",
				dateOrder: "whatever",
			},
			asLog(makeLog()),
		);
		expect(repo.findAll.mock.calls[0][0]).toMatchObject({ dateField: "date" });
	});
});

describe("GetTransactionUseCase", () => {
	it("looks the transaction up by id", () => {
		const repo = fakeRepo();
		new GetTransactionUseCase(asRepo(repo)).execute(9, asLog(makeLog()));
		expect(repo.findById).toHaveBeenCalledWith(9);
	});
});

describe("CreateTransactionUseCase", () => {
	it("creates the parent, its children and their tag links", async () => {
		const repo = fakeRepo();
		const body = {
			name: "Groceries",
			categoryId: 0,
			paymentTypeId: 4,
			tags: [{ id: 1 }],
			children: [{ name: "sub", categoryId: 2, paymentTypeId: 0, tags: [{ id: 2 }] }],
		};

		const result = await new CreateTransactionUseCase(asRepo(repo)).execute(body as any, asLog(makeLog()));

		// parent + one child
		expect(repo.create).toHaveBeenCalledTimes(2);
		expect(repo.create.mock.calls[0][0]).toMatchObject({ categoryId: null, paymentTypeId: 4 });
		expect(repo.create.mock.calls[1][0]).toMatchObject({
			categoryId: 2,
			paymentTypeId: null,
			parentId: 100,
			date: "2024-01-01",
		});
		// tag links for child then parent
		expect(repo.bulkCreateTags).toHaveBeenCalledWith([{ transactionId: 100, tagId: 2 }]);
		expect(repo.bulkCreateTags).toHaveBeenCalledWith([{ transactionId: 100, tagId: 1 }]);
		expect(result).toEqual({ id: 100, date: "2024-01-01" });
	});
});

describe("DeleteTransactionUseCase", () => {
	it("throws when the transaction is missing", async () => {
		await expect(new DeleteTransactionUseCase(asRepo(fakeRepo())).execute(1, asLog(makeLog()))).rejects.toThrow(
			"Transaction not found",
		);
	});

	it("destroys the transaction, its children and the tag links of all of them", async () => {
		const repo = fakeRepo();
		const t = { id: "db-transaction" };
		repo.runInTransaction.mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(t));
		const children = [{ id: 2 }, { id: 3 }];
		const transaction = { id: 1, children };
		repo.findByIdWithChildren.mockResolvedValue(transaction);

		const result = await new DeleteTransactionUseCase(asRepo(repo)).execute(1, asLog(makeLog()));

		expect(result).toEqual({ deleted: true });
		expect(repo.deleteTransactionTags).toHaveBeenCalledWith([1, 2, 3], { transaction: t });
		expect(repo.destroyInstance).toHaveBeenCalledTimes(3);
		expect(repo.destroyInstance).toHaveBeenCalledWith(children[0], { transaction: t });
		expect(repo.destroyInstance).toHaveBeenCalledWith(children[1], { transaction: t });
		expect(repo.destroyInstance).toHaveBeenCalledWith(transaction, { transaction: t });
	});
});

describe("list-by-relation use cases", () => {
	it("ListTransactionsByAccount merges direct and sub transactions sorted by date/time", async () => {
		const repo = fakeRepo();
		repo.findDirectTransactionsByAccount.mockResolvedValue([{ ref: "d", date: "2024-02-01", time: "10:00" }]);
		repo.findSubTransactionsByAccount.mockResolvedValue([{ ref: "s", date: "2024-01-01", time: "10:00" }]);

		const all = await new ListTransactionsByAccountUseCase(asRepo(repo)).execute(1, asLog(makeLog()));
		expect(all.map((t: any) => t.ref)).toEqual(["s", "d"]);
	});

	it("ListTransactionsByCategory expands sub-categories before querying", async () => {
		const repo = fakeRepo();
		repo.findSubCategories.mockResolvedValue([{ id: 20 }, { id: 21 }]);

		await new ListTransactionsByCategoryUseCase(asRepo(repo)).execute(2, asLog(makeLog()));

		expect(repo.findDirectTransactionsByCategory).toHaveBeenCalledWith([2, 20, 21]);
		expect(repo.findSubTransactionsByCategory).toHaveBeenCalledWith([2, 20, 21]);
	});

	it("ListTransactionsByTag merges direct and sub transactions", async () => {
		const repo = fakeRepo();
		repo.findDirectTransactionsByTag.mockResolvedValue([{ ref: "d", date: "2024-01-02" }]);
		repo.findSubTransactionsByTag.mockResolvedValue([{ ref: "s", date: "2024-01-01" }]);

		const all = await new ListTransactionsByTagUseCase(asRepo(repo)).execute(7, asLog(makeLog()));
		expect(all.map((t: any) => t.ref)).toEqual(["s", "d"]);
	});
});
