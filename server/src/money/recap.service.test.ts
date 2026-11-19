import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoriesRepository } from "./categories/categories.repository.js";
import { RecapService } from "./recap.service.js";
import { TransactionsRepository } from "./transactions/transactions.repository.js";

const FOOD = { id: 1, name: "Food", parentId: null };
const GROCERIES = { id: 2, name: "Groceries", parentId: 1 };
const SALARY = { id: 3, name: "Salary", parentId: null };

describe("RecapService", () => {
	let service: RecapService;
	const categoriesRepo = { findAll: vi.fn() };
	const transactionsRepo = { findAllForRecap: vi.fn() };

	beforeEach(async () => {
		vi.resetAllMocks();
		categoriesRepo.findAll.mockResolvedValue([FOOD, GROCERIES, SALARY]);
		transactionsRepo.findAllForRecap.mockResolvedValue([
			{ considerationDate: "2024-01-10", amount: -30, category: GROCERIES, children: [] },
			{ considerationDate: "2024-02-03", amount: -10, category: FOOD, children: [] },
			{
				considerationDate: "2024-02-05",
				amount: 0,
				category: null,
				children: [{ amount: 2000, category: SALARY }],
			},
			{ considerationDate: "2024-02-06", amount: -999, informative: true, category: FOOD, children: [] },
		]);
		const ref = await Test.createTestingModule({
			providers: [
				RecapService,
				{ provide: CategoriesRepository, useValue: categoriesRepo },
				{ provide: TransactionsRepository, useValue: transactionsRepo },
			],
		}).compile();
		service = ref.get(RecapService);
	});

	it("sums debit and credit by category and month, largest category first", async () => {
		const recap = await service.recap({ from: "2024-01-01", to: "2024-03-31", regroupCategory: false });

		expect(recap.data.map((c) => c.name)).toEqual(["Salary", "Groceries", "Food"]);
		expect(recap.data[1].months).toMatchObject({
			"2024-01": { debit: -30, credit: 0 },
			total: { debit: -30, credit: 0 },
			moyenne: { total: -15 }, // over the 2 months with data
		});
		expect(recap).toMatchObject({
			nbMonths: 2,
			total: { "2024-01": -30, "2024-02": 1990 }, // informative transaction left out
			months: ["2024-01", "2024-02"],
			allMonths: ["2024-01", "2024-02", "2024-03"],
		});
	});

	it("regroups the sub-categories under their parent", async () => {
		const recap = await service.recap({ from: "2024-01-01", to: "2024-03-31", regroupCategory: true });

		const food = recap.data.find((c) => c.id === FOOD.id);
		expect(recap.data.map((c) => c.name)).toEqual(["Salary", "Food"]);
		expect(food?.months).toMatchObject({ total: { debit: -40, credit: 0 } });
	});
});
