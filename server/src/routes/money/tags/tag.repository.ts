import type { CreateTagBody, UpdateTagBody } from "@personal-tracker/shared/money";
import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import { moneyTag } from "../../../db/schema";

export class TagRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll() {
		return this.db.query.moneyTag.findMany({
			orderBy: { name: "asc" },
			with: { children: true },
		});
	}

	findById(id: number) {
		return this.db.query.moneyTag.findFirst({
			where: { id },
			with: { children: true },
		});
	}

	findSubTags(id: number) {
		return this.db.query.moneyTag.findMany({ where: { parentId: id } });
	}

	findTransactionsUsingTag(id: number) {
		return this.db.query.moneyTransaction.findMany({ where: { tags: { id } } });
	}

	async create(data: CreateTagBody) {
		const [{ id }] = await this.db.insert(moneyTag).values(data).returning({ id: moneyTag.id });
		return this.db.query.moneyTag.findFirst({ where: { id } });
	}

	async update(id: number, data: UpdateTagBody) {
		const tag = await this.db.query.moneyTag.findFirst({ where: { id } });
		if (!tag) return null;
		await this.db.update(moneyTag).set(data).where(eq(moneyTag.id, id));
		return this.db.query.moneyTag.findFirst({ where: { id } });
	}

	async destroy(id: number): Promise<boolean> {
		const result = await this.db.delete(moneyTag).where(eq(moneyTag.id, id));
		return (result.rowCount ?? 0) > 0;
	}

	findAllWithTransactionsForAnalytics() {
		return this.db.query.moneyTag.findMany({
			with: { children: true, transactions: true },
		});
	}
}
