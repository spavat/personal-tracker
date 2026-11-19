import { Inject, Injectable } from "@nestjs/common";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { contains } from "../../database/contains.query.js";
import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { moneyTransaction, moneyTransactionTag } from "../../database/schema.js";

export type Tx = Parameters<Parameters<Drizzle["transaction"]>[0]>[0];
type TagLink = { transactionId: number; tagId: number };

interface ListFilters {
	searchText?: string;
	from?: string;
	to?: string;
	dateField: "date" | "considerationDate";
}

// Transactions without a time come first in their day (Postgres sorts NULLs last by default)
const ORDER_BY_DATE = (t: typeof moneyTransaction) => [asc(t.date), sql`${t.time} asc nulls first`, desc(t.amount)];
const ORDER_BY_CONSIDERATION_DATE = (t: typeof moneyTransaction) => [
	sql`${t.considerationDate} asc nulls first`,
	sql`${t.time} asc nulls first`,
	desc(t.amount),
];

@Injectable()
export class TransactionsRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

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
				children: { orderBy: { id: "asc" }, with: { category: true, paymentType: true, tags: true } },
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
				children: { with: { category: true, paymentType: true } },
			},
		});
	}

	findAllForBanksOverview({ from }: { from: string }) {
		return this.db.query.moneyTransaction.findMany({
			where: { considerationDate: { gte: from }, parentId: { isNull: true } },
			orderBy: ORDER_BY_DATE,
			with: {
				paymentType: { with: { account: true } },
				children: { with: { paymentType: { with: { account: true } } } },
			},
		});
	}

	findById(id: number) {
		return this.db.query.moneyTransaction.findFirst({
			where: { id },
			with: {
				category: true,
				paymentType: true,
				children: { orderBy: { id: "asc" }, with: { category: true, paymentType: true, tags: true } },
				tags: true,
			},
		});
	}

	findByIdWithChildren(id: number) {
		return this.db.query.moneyTransaction.findFirst({ where: { id }, with: { children: true } });
	}

	async create(data: any, tx: Tx | Drizzle = this.db) {
		const [{ id }] = await tx.insert(moneyTransaction).values(data).returning({ id: moneyTransaction.id });
		const created = await tx.query.moneyTransaction.findFirst({ where: { id } });
		return created!;
	}

	createTags(links: TagLink[], tx: Tx | Drizzle = this.db) {
		return tx.insert(moneyTransactionTag).values(links);
	}

	deleteTags(transactionIds: number[], tx: Tx | Drizzle = this.db) {
		return tx.delete(moneyTransactionTag).where(inArray(moneyTransactionTag.transactionId, transactionIds));
	}

	update(id: number, data: any, tx: Tx | Drizzle = this.db) {
		return tx.update(moneyTransaction).set(data).where(eq(moneyTransaction.id, id));
	}

	destroy(id: number, tx: Tx | Drizzle = this.db) {
		return tx.delete(moneyTransaction).where(eq(moneyTransaction.id, id));
	}

	runInTransaction<T>(fn: (tx: Tx) => Promise<T>) {
		return this.db.transaction(fn);
	}

	findSubCategories(categoryId: number) {
		return this.db.query.moneyCategory.findMany({ where: { parentId: categoryId } });
	}

	findDirectTransactionsByAccount(accountId: number) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNull: true }, paymentType: { accountId } },
			orderBy: ORDER_BY_DATE,
			with: {
				category: true,
				paymentType: true,
				children: { orderBy: { id: "asc" }, with: { category: true, paymentType: true } },
			},
		});
	}

	findSubTransactionsByAccount(accountId: number) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNotNull: true }, paymentType: { accountId } },
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
				children: { orderBy: { id: "asc" }, with: { category: true, paymentType: true } },
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
				children: { orderBy: { id: "asc" }, with: { category: true, paymentType: true } },
				tags: { where: { id: tagId } },
			},
		});
	}

	findSubTransactionsByTag(tagId: number) {
		return this.db.query.moneyTransaction.findMany({
			where: { parentId: { isNotNull: true }, tags: { id: tagId } },
			orderBy: ORDER_BY_DATE,
			with: { category: true, paymentType: true, parent: true, tags: { where: { id: tagId } } },
		});
	}
}
