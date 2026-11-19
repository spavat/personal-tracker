import type { CreateCategoryBody, UpdateCategoryBody } from "@personal-tracker/shared/money";

import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { moneyCategory } from "../../database/schema.js";

@Injectable()
export class CategoriesRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

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
