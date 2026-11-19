import { FastifyBaseLogger } from "fastify";

import type { moneyCategory, moneyTransaction } from "../../db/schema";
import type { CategoryRepository } from "./categories/category.repository";
import type { TransactionRepository } from "./transactions/transaction.repository";

import { getMonthsBetween } from "../../utils.date";

type Category = typeof moneyCategory.$inferSelect;
type Transaction = typeof moneyTransaction.$inferSelect;

interface Response {
	id: number;
	name: string | null;
	months: {
		[key: string]: { debit: number; credit: number; total?: number };
	};
}

export class GetRecapUseCase {
	constructor(
		private categoryRepo: CategoryRepository,
		private transactionRepo: TransactionRepository,
	) {}

	async execute(
		{ from, to, regroupCategory }: { from: string; to: string; regroupCategory: boolean },
		log: FastifyBaseLogger,
	) {
		log.info({ from, to, regroupCategory }, "GetRecapUseCase.execute");

		// Catégorie
		const allCategories = await this.categoryRepo.findAll();
		const transactions = await this.transactionRepo.findAllForRecap({ from, to });

		const results: Record<string, Record<string, { debit: number; credit: number }>> = {}; // indexé sur la catégeorie
		const categories: Record<string, Category> = {};
		const months = new Set<string>();
		const resultsByMonths: Record<string, number> = {};

		function handleTransaction(transaction: Transaction, category: Category, yearAndMonth: string) {
			let categoryId = category.id;

			if (regroupCategory) {
				const cat = allCategories.find((c) => c.id === categoryId);

				const parentId = cat?.parentId ?? null;
				if (parentId) {
					categoryId = parentId;

					const catParent = allCategories.find((c) => c.id === parentId);
					if (!categories[categoryId] && catParent) {
						categories[categoryId] = catParent;
					}
				}
			}

			// Gestion des catégories
			if (!categories[categoryId]) {
				categories[categoryId] = category;
			}
			// gestion des months
			months.add(yearAndMonth);

			// Gestion de la transaction
			if (!results[categoryId]) {
				results[categoryId] = { total: { debit: 0, credit: 0 } };
			}

			if (!results[categoryId][yearAndMonth]) {
				results[categoryId][yearAndMonth] = { debit: 0, credit: 0 };
			}
			const amount = transaction.amount ?? 0;
			if (amount < 0) {
				results[categoryId][yearAndMonth].debit += amount;
			} else {
				results[categoryId][yearAndMonth].credit += amount;
			}
			if (amount < 0) {
				results[categoryId].total.debit += amount;
			} else {
				results[categoryId].total.credit += amount;
			}

			// By mopnth
			if (!resultsByMonths[yearAndMonth]) {
				resultsByMonths[yearAndMonth] = 0;
			}
			resultsByMonths[yearAndMonth] += amount;
		}

		transactions.forEach((transaction) => {
			if (transaction.informative) {
				return;
			}

			const yearAndMonth = (transaction.considerationDate ?? "").substring(0, 7);
			if (transaction.category) {
				handleTransaction(transaction, transaction.category, yearAndMonth);
			}

			(transaction.children ?? []).forEach((subTransaction) => {
				if (subTransaction.category) {
					handleTransaction(subTransaction, subTransaction.category, yearAndMonth);
				}
			});
		});

		// Format result + calcul totalByMonth
		const response = Object.entries(results).map(([key, value]) => {
			const id = parseInt(key, 10);
			// calcul moyenne
			const { total, ...monthValues } = value;

			const moyenne =
				Object.values(monthValues).reduce((acc, month) => acc + month.debit + month.credit, 0) / months.size;
			return {
				id,
				name: categories[id].name,
				months: { ...value, moyenne: { debit: 0, credit: 0, total: moyenne } },
			};
		});
		response.sort((a: Response, b: Response) => {
			const totalA = Math.abs(a.months.total.debit + a.months.total.credit);
			const totalB = Math.abs(b.months.total.debit + b.months.total.credit);
			return totalB - totalA;
		});

		return {
			nbMonths: months.size,
			data: response,
			total: resultsByMonths,
			months: Object.keys(resultsByMonths).toSorted((a, b) => a.localeCompare(b)),
			allMonths: getMonthsBetween({ from, to }),
		};
	}
}
