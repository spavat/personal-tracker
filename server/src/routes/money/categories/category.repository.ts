import type { CreateCategoryBody, UpdateCategoryBody } from "@personal-tracker/shared/money";
import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import { moneyCategory } from "../../../db/schema";

export class CategoryRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll() {
		return this.db.query.moneyCategory.findMany({
			orderBy: { name: "asc" },
			with: { children: true },
		});
	}

	findById(id: number) {
		return this.db.query.moneyCategory.findFirst({
			where: { id },
			with: { children: true },
		});
	}

	findSubCategories(id: number) {
		return this.db.query.moneyCategory.findMany({ where: { parentId: id } });
	}

	findTransactionsUsingCategory(id: number) {
		return this.db.query.moneyTransaction.findMany({ where: { categoryId: id } });
	}

	async create(data: CreateCategoryBody) {
		const [{ id }] = await this.db.insert(moneyCategory).values(data).returning({ id: moneyCategory.id });
		return this.db.query.moneyCategory.findFirst({ where: { id } });
	}

	async update(id: number, data: UpdateCategoryBody) {
		const category = await this.db.query.moneyCategory.findFirst({ where: { id } });
		if (!category) return null;
		await this.db.update(moneyCategory).set(data).where(eq(moneyCategory.id, id));
		return this.db.query.moneyCategory.findFirst({ where: { id } });
	}

	async destroy(id: number): Promise<boolean> {
		const result = await this.db.delete(moneyCategory).where(eq(moneyCategory.id, id));
		return (result.rowCount ?? 0) > 0;
	}
}
