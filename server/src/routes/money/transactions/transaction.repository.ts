import type { FastifyInstance } from "fastify";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { contains } from "../../../db/contains";
import { moneyTransaction, moneyTransactionTag } from "../../../db/schema";

type Db = FastifyInstance["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Transaction = typeof moneyTransaction.$inferSelect;

interface ListFilters {
	searchText?: string;
	from?: string;
	to?: string;
	dateField: "date" | "considerationDate";
}

// Transactions without a time come first in their day (Postgres sorts NULLs last by default)
export const ORDER_BY_DATE = (t: typeof moneyTransaction) => [
	asc(t.date),
	sql`${t.time} asc nulls first`,
	desc(t.amount),
];
const ORDER_BY_CONSIDERATION_DATE = (t: typeof moneyTransaction) => [
	sql`${t.considerationDate} asc nulls first`,
	sql`${t.time} asc nulls first`,
	desc(t.amount),
];

export class TransactionRepository {
	constructor(private db: Db) {}

	findAll({ searchText, from, to, dateField }: ListFilters) {
		const range = { gte: from, lte: to };
		return this.db.query.moneyTransaction.findMany({
			where: {
				...(searchText
					? {
							OR: [
								{ RAW: (t) => contains(t.description, searchText) },
								{ RAW: (t) => contains(t.name, searchText) },
								{ RAW: (t) => contains(t.comment, searchText) },
							],
						}
					: {}),
				...(from && to ? (dateField === "date" ? { date: range } : { considerationDate: range }) : {}),
				parentId: { isNull: true },
			},
			orderBy: dateField === "date" ? ORDER_BY_DATE : ORDER_BY_CONSIDERATION_DATE,
			with: {
				category: true,
				paymentType: true,
				children: {
					orderBy: { id: "asc" },
					with: { category: true, paymentType: true, tags: true },
				},
				tags: true,
			},
		});
	}

	findAllForRecap({ from, to }: { from?: string; to?: string } = {}) {
		return this.db.query.moneyTransaction.findMany({
			where: {
				...(from && to ? { considerationDate: { gte: from, lte: to } } : {}),
				parentId: { isNull: true },
			},
			orderBy: ORDER_BY_DATE,
			with: {
				category: true,
				paymentType: true,
				children: {
					with: { category: true, paymentType: true },
				},
			},
		});
	}

	findAllForBanksOverview({ from }: { from: string }) {
		return this.db.query.moneyTransaction.findMany({
			where: {
				considerationDate: { gte: from },
				parentId: { isNull: true },
			},
			orderBy: ORDER_BY_DATE,
			with: {
				paymentType: { with: { account: true } },
				children: {
					with: { paymentType: { with: { account: true } } },
				},
			},
		});
	}

	// `?? null`: an `undefined` result would be sent as an empty body
	async findById(id: number) {
		return (
			(await this.db.query.moneyTransaction.findFirst({
				where: { id },
				with: {
					category: true,
					paymentType: true,
					children: {
						orderBy: { id: "asc" },
						with: { category: true, paymentType: true, tags: true },
					},
					tags: true,
				},
			})) ?? null
		);
	}

	findByIdWithChildren(id: number) {
		return this.db.query.moneyTransaction.findFirst({
			where: { id },
			with: { children: true },
		});
	}

	async create(data: any, options?: { transaction: Tx }) {
		const db = options?.transaction ?? this.db;
		const [{ id }] = await db.insert(moneyTransaction).values(data).returning({ id: moneyTransaction.id });
		const created = await db.query.moneyTransaction.findFirst({ where: { id } });
		return created!;
	}

	bulkCreateTags(links: Array<{ transactionId: number; tagId: number }>, options?: { transaction: Tx }) {
		return (options?.transaction ?? this.db).insert(moneyTransactionTag).values(links);
	}

	deleteTransactionTags(transactionIds: number[], options?: { transaction: Tx }) {
		return (options?.transaction ?? this.db)
			.delete(moneyTransactionTag)
			.where(inArray(moneyTransactionTag.transactionId, transactionIds));
	}

	updateInstance(instance: Transaction, data: any, options?: { transaction: Tx }) {
		return (options?.transaction ?? this.db)
			.update(moneyTransaction)
			.set(data)
			.where(eq(moneyTransaction.id, instance.id));
	}

	destroyInstance(instance: Transaction, options?: { transaction: Tx }) {
		return (options?.transaction ?? this.db).delete(moneyTransaction).where(eq(moneyTransaction.id, instance.id));
	}

	runInTransaction<T>(fn: (t: Tx) => Promise<T>) {
		return this.db.transaction(fn);
	}

	findSubCategories(categoryId: number) {
		return this.db.query.moneyCategory.findMany({ where: { parentId: categoryId } });
	}

	findDirectTransactionsByAccount(accountId: number) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNull: true }, paymentType: { accountId: accountId } },
			orderBy: ORDER_BY_DATE,
			with: {
				category: true,
				paymentType: true,
				children: {
					orderBy: { id: "asc" },
					with: { category: true, paymentType: true },
				},
			},
		});
	}

	findSubTransactionsByAccount(accountId: number) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNotNull: true }, paymentType: { accountId: accountId } },
			orderBy: ORDER_BY_DATE,
			with: { category: true, paymentType: true, parent: true },
		});
	}

	findDirectTransactionsByCategory(categoryIds: number[]) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNull: true }, categoryId: { in: categoryIds } },
			orderBy: ORDER_BY_DATE,
			with: {
				category: true,
				paymentType: true,
				children: {
					orderBy: { id: "asc" },
					with: { category: true, paymentType: true },
				},
			},
		});
	}

	findSubTransactionsByCategory(categoryIds: number[]) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNotNull: true }, categoryId: { in: categoryIds } },
			orderBy: ORDER_BY_DATE,
			with: { category: true, paymentType: true, parent: true },
		});
	}

	// Only the searched tag is returned in `tags`
	findDirectTransactionsByTag(tagId: number) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNull: true }, tags: { id: tagId } },
			orderBy: ORDER_BY_DATE,
			with: {
				category: true,
				paymentType: true,
				children: {
					orderBy: { id: "asc" },
					with: { category: true, paymentType: true },
				},
				tags: { where: { id: tagId } },
			},
		});
	}

	findSubTransactionsByTag(tagId: number) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNotNull: true }, tags: { id: tagId } },
			orderBy: ORDER_BY_DATE,
			with: {
				category: true,
				paymentType: true,
				parent: true,
				tags: { where: { id: tagId } },
			},
		});
	}
}
