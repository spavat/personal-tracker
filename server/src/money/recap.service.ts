import { Injectable, Logger } from "@nestjs/common";

import type { moneyCategory } from "../database/schema.js";

import { getMonthsBetween } from "../common/utils.date.js";
import { CategoriesRepository } from "./categories/categories.repository.js";
import { TransactionsRepository } from "./transactions/transactions.repository.js";

type Category = typeof moneyCategory.$inferSelect;
type DebitCredit = { debit: number; credit: number };

export interface RecapQuery {
	from: string;
	to: string;
	regroupCategory: boolean;
}

// Debit / credit by category and by month, over the transactions' consideration date
@Injectable()
export class RecapService {
	private readonly logger = new Logger(RecapService.name);
	constructor(
		// both exported by their sub-module
		private readonly categoriesRepo: CategoriesRepository,
		private readonly transactionsRepo: TransactionsRepository,
	) {}

	async recap({ from, to, regroupCategory }: RecapQuery) {
		this.logger.log(`recap ${from} - ${to}${regroupCategory ? " (regrouped)" : ""}`);
		const allCategories = await this.categoriesRepo.findAll();
		const categoryById = new Map(allCategories.map((c) => [c.id, c]));
		const transactions = await this.transactionsRepo.findAllForRecap({ from, to });

		const results: Record<string, Record<string, DebitCredit>> = {}; // by category id, then month (+ "total")
		const categories: Record<string, Category> = {};
		const months = new Set<string>();
		const totalByMonth: Record<string, number> = {};

		const handle = (amount: number | null, category: Category, yearAndMonth: string) => {
			let categoryId = category.id;
			if (regroupCategory) {
				const parentId = categoryById.get(categoryId)?.parentId ?? null;
				const parent = parentId ? categoryById.get(parentId) : undefined;
				if (parentId) {
					categoryId = parentId;
					if (!categories[categoryId] && parent) {
						categories[categoryId] = parent;
					}
				}
			}
			categories[categoryId] ??= category;
			months.add(yearAndMonth);

			results[categoryId] ??= { total: { debit: 0, credit: 0 } };
			results[categoryId][yearAndMonth] ??= { debit: 0, credit: 0 };
			const value = amount ?? 0;
			const side = value < 0 ? "debit" : "credit";
			results[categoryId][yearAndMonth][side] += value;
			results[categoryId].total[side] += value;

			totalByMonth[yearAndMonth] = (totalByMonth[yearAndMonth] ?? 0) + value;
		};

		for (const transaction of transactions) {
			if (transaction.informative) continue;
			const yearAndMonth = (transaction.considerationDate ?? "").substring(0, 7);
			if (transaction.category) {
				handle(transaction.amount, transaction.category, yearAndMonth);
			}
			for (const child of transaction.children) {
				if (child.category) {
					handle(child.amount, child.category, yearAndMonth);
				}
			}
		}

		// Largest categories (absolute total) first
		const weight = (value: Record<string, DebitCredit>) => Math.abs(value.total.debit + value.total.credit);
		const data = Object.entries(results)
			.toSorted(([, a], [, b]) => weight(b) - weight(a))
			.map(([key, value]) => {
				const id = parseInt(key, 10);
				const { total, ...monthValues } = value;
				const average =
					Object.values(monthValues).reduce((acc, month) => acc + month.debit + month.credit, 0) /
					months.size;
				return {
					id,
					name: categories[id].name,
					// "moyenne": key read by the front
					months: { ...value, moyenne: { debit: 0, credit: 0, total: average } },
				};
			});

		return {
			nbMonths: months.size,
			data,
			total: totalByMonth,
			months: Object.keys(totalByMonth).toSorted((a, b) => a.localeCompare(b)),
			allMonths: getMonthsBetween({ from, to }),
		};
	}
}
