import type { CreatePaymentTypeBody, UpdatePaymentTypeBody } from "@personal-tracker/shared/money";

import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { moneyPaymentType } from "../../database/schema.js";

@Injectable()
export class PaymentTypesRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	findAll() {
		return this.db.query.moneyPaymentType.findMany({ orderBy: { name: "asc" } });
	}

	findById(id: number) {
		return this.db.query.moneyPaymentType.findFirst({ where: { id } });
	}

	findByIdWithTransactions(id: number) {
		return this.db.query.moneyPaymentType.findFirst({ where: { id }, with: { transactions: true } });
	}

	async create(data: CreatePaymentTypeBody) {
		const [{ id }] = await this.db.insert(moneyPaymentType).values(data).returning({ id: moneyPaymentType.id });
		return this.findById(id);
	}

	async update(id: number, data: UpdatePaymentTypeBody) {
		const paymentType = await this.findById(id);
		if (!paymentType) return null;
		await this.db.update(moneyPaymentType).set(data).where(eq(moneyPaymentType.id, id));
		return this.findById(id);
	}

	findTransactionsUsingPaymentType(id: number) {
		return this.db.query.moneyTransaction.findMany({ where: { paymentTypeId: id } });
	}

	destroy(id: number) {
		return this.db.delete(moneyPaymentType).where(eq(moneyPaymentType.id, id));
	}
}
