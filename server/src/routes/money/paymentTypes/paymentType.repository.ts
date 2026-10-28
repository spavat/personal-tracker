import type { CreatePaymentTypeBody, UpdatePaymentTypeBody } from "@personal-tracker/shared/money";
import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import { moneyPaymentType } from "../../../db/schema";

type PaymentType = typeof moneyPaymentType.$inferSelect;

export class PaymentTypeRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll() {
		return this.db.query.moneyPaymentType.findMany({ orderBy: { name: "asc" } });
	}

	// `?? null`: an `undefined` result would be sent as an empty body
	async findById(id: number) {
		return (await this.db.query.moneyPaymentType.findFirst({ where: { id } })) ?? null;
	}

	async findByIdWithTransactions(id: number) {
		return (
			(await this.db.query.moneyPaymentType.findFirst({
				where: { id },
				with: { transactions: true },
			})) ?? null
		);
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

	destroy(paymentType: PaymentType) {
		return this.db.delete(moneyPaymentType).where(eq(moneyPaymentType.id, paymentType.id));
	}
}
