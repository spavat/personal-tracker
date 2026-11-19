import type { CreateAccountBody, UpdateAccountBody } from "@personal-tracker/shared/money";

import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { moneyAccount } from "../../database/schema.js";

@Injectable()
export class AccountsRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	findAll() {
		return this.db.query.moneyAccount.findMany({ orderBy: { name: "asc" } });
	}

	findById(id: number) {
		return this.db.query.moneyAccount.findFirst({ where: { id } });
	}

	findByIdWithDetails(id: number) {
		return this.db.query.moneyAccount.findFirst({
			where: { id },
			with: { history: { orderBy: { date: "asc" } }, paymentTypes: true },
		});
	}

	findByIdWithRelationsForDelete(id: number) {
		return this.db.query.moneyAccount.findFirst({ where: { id }, with: { history: true, paymentTypes: true } });
	}

	async create(data: CreateAccountBody) {
		const [{ id }] = await this.db.insert(moneyAccount).values(data).returning({ id: moneyAccount.id });
		return this.findById(id);
	}

	async update(id: number, data: UpdateAccountBody) {
		const account = await this.findById(id);
		if (!account) return null;
		await this.db.update(moneyAccount).set(data).where(eq(moneyAccount.id, id));
		return this.findById(id);
	}

	destroy(id: number) {
		return this.db.delete(moneyAccount).where(eq(moneyAccount.id, id));
	}
}
