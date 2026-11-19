import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { TagsRepository } from "./tags.repository.js";
import { TagsService } from "./tags.service.js";

describe("TagsService", () => {
	let service: TagsService;
	const repo = {
		findById: vi.fn(),
		findSubTags: vi.fn(),
		findTransactionsUsingTag: vi.fn(),
		destroy: vi.fn(),
		findAllWithTransactionsForAnalytics: vi.fn(),
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		repo.findSubTags.mockResolvedValue([]);
		repo.findTransactionsUsingTag.mockResolvedValue([]);
		repo.destroy.mockResolvedValue(true);
		const ref = await Test.createTestingModule({
			providers: [TagsService, { provide: TagsRepository, useValue: repo }],
		}).compile();
		service = ref.get(TagsService);
	});

	it("get merges the tag with its transactions count", async () => {
		repo.findById.mockResolvedValue({ id: 1, name: "trip" });
		repo.findTransactionsUsingTag.mockResolvedValue([{}, {}]);

		expect(await service.get(1)).toEqual({ id: 1, name: "trip", transactions: 2 });
	});

	describe("delete", () => {
		it("refuses while sub-tags exist", async () => {
			repo.findSubTags.mockResolvedValue([{}]);
			await expect(service.delete(1)).rejects.toBeInstanceOf(ConflictError);
			expect(repo.destroy).not.toHaveBeenCalled();
		});

		it("refuses while transactions still use the tag", async () => {
			repo.findTransactionsUsingTag.mockResolvedValue([{}]);
			await expect(service.delete(1)).rejects.toBeInstanceOf(ConflictError);
		});

		it("rejects with NotFoundError when nothing was deleted", async () => {
			repo.destroy.mockResolvedValue(false);
			await expect(service.delete(1)).rejects.toBeInstanceOf(NotFoundError);
		});

		it("deletes an unused tag", async () => {
			await expect(service.delete(1)).resolves.toBeUndefined();
		});
	});

	describe("analytics", () => {
		const tags = [
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
			{ name: "Food\\Bakery", icon: "", textColor: "", backgroundColor: "", transactions: [] },
		];

		it("groups the tags by parent with their amounts per year", async () => {
			repo.findAllWithTransactionsForAnalytics.mockResolvedValue(tags);

			expect(await service.analytics(false)).toEqual([
				{
					name: "Food",
					badges: [
						{
							name: "Bakery",
							icon: "",
							textColor: "",
							backgroundColor: "",
							amount: 0,
							comment: "0",
							parts: [],
						},
						{
							name: "Groceries",
							icon: "ic",
							textColor: "tc",
							backgroundColor: "bc",
							amount: -40,
							comment: "2",
							parts: [
								{ name: "2023", amount: -10, comment: "1" },
								{ name: "2024", amount: -30, comment: "1" },
							],
						},
					],
				},
			]);
		});

		it("with splitParent, makes one badge per parent and year, split by child tag", async () => {
			repo.findAllWithTransactionsForAnalytics.mockResolvedValue(tags);

			const [food] = await service.analytics(true);

			expect(food.badges.map(({ name, amount, comment }) => [name, amount, comment])).toEqual([
				["Food 2023", -10, "1"],
				["Food 2024", -30, "1"],
			]);
			expect(food.badges[1].parts).toEqual([{ name: "Groceries", amount: -30, comment: "1" }]);
		});
	});
});
