import { describe, expect, it, vi } from "vitest";

import type { TagRepository } from "./tag.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	CreateTagUseCase,
	DeleteTagUseCase,
	GetTagAnalyticsUseCase,
	GetTagUseCase,
	ListTagsUseCase,
	UpdateTagUseCase,
} from "./tag.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		findTransactionsUsingTag: vi.fn().mockResolvedValue([]),
		findSubTags: vi.fn().mockResolvedValue([]),
		create: vi.fn().mockResolvedValue({ id: 1 }),
		update: vi.fn().mockResolvedValue({ id: 1 }),
		destroy: vi.fn().mockResolvedValue(true),
		findAllWithTransactionsForAnalytics: vi.fn().mockResolvedValue([]),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as TagRepository;

describe("tag CRUD use cases", () => {
	it("list / create / update delegate through", () => {
		const repo = fakeRepo();
		new ListTagsUseCase(asRepo(repo)).execute(asLog(makeLog()));
		new CreateTagUseCase(asRepo(repo)).execute({ name: "trip" } as any, asLog(makeLog()));
		new UpdateTagUseCase(asRepo(repo)).execute({ id: 1, data: { name: "trip2" } as any }, asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalled();
		expect(repo.create).toHaveBeenCalledWith({ name: "trip" });
		expect(repo.update).toHaveBeenCalledWith(1, { name: "trip2" });
	});

	it("GetTagUseCase merges the tag with a transactions count", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ id: 1, name: "trip" });
		repo.findTransactionsUsingTag.mockResolvedValue([{}, {}]);
		expect(await new GetTagUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toEqual({
			id: 1,
			name: "trip",
			transactions: 2,
		});
	});
});

describe("DeleteTagUseCase", () => {
	it("returns false when sub-tags exist", async () => {
		const repo = fakeRepo();
		repo.findSubTags.mockResolvedValue([{}]);
		expect(await new DeleteTagUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toBe(false);
	});

	it("returns false when transactions still use the tag", async () => {
		const repo = fakeRepo();
		repo.findTransactionsUsingTag.mockResolvedValue([{}]);
		expect(await new DeleteTagUseCase(asRepo(repo)).execute(1, asLog(makeLog()))).toBe(false);
	});

	it("returns true once destroyed", async () => {
		expect(await new DeleteTagUseCase(asRepo(fakeRepo())).execute(1, asLog(makeLog()))).toBe(true);
	});
});

describe("GetTagAnalyticsUseCase (grouped, splitParent = false)", () => {
	it("groups badges by parent and sums transaction amounts per year", async () => {
		const repo = fakeRepo();
		repo.findAllWithTransactionsForAnalytics.mockResolvedValue([
			{
				name: "Food\\Groceries",
				icon: "ic",
				textColor: "tc",
				backgroundColor: "bc",
				transactions: [
					{ considerationDate: "2024-05-01", date: "2024-05-01", amount: -30 },
					{ considerationDate: null, date: "2023-01-01", amount: -10 },
				],
			},
		]);

		const result = await new GetTagAnalyticsUseCase(asRepo(repo)).execute(false, asLog(makeLog()));

		expect(result).toEqual([
			{
				name: "Food",
				badges: [
					{
						name: "Groceries",
						icon: "ic",
						textColor: "tc",
						backgroundColor: "bc",
						amount: -40,
						comment: "2",
						// numeric-string keys => Object.values yields them in ascending order
						parts: [
							{ name: "2023", amount: -10, comment: "1" },
							{ name: "2024", amount: -30, comment: "1" },
						],
					},
				],
			},
		]);
	});
});
