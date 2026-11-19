import type { CreateBankBody, UpdateBankBody } from "@personal-tracker/shared/money";
import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import { moneyBank } from "../../../db/schema";

type Bank = typeof moneyBank.$inferSelect;

export class BankRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll() {
		return this.db.query.moneyBank.findMany({ orderBy: { name: "asc" } });
	}

	// `?? null`: an `undefined` result would be sent as an empty body
	async findById(id: number) {
		return (
			(await this.db.query.moneyBank.findFirst({
				where: { id },
				with: { accounts: { with: { paymentTypes: true } } },
			})) ?? null
		);
	}

	async create(data: CreateBankBody) {
		const [{ id }] = await this.db.insert(moneyBank).values(data).returning({ id: moneyBank.id });
		return this.db.query.moneyBank.findFirst({ where: { id } });
	}

	async update(id: number, data: UpdateBankBody) {
		const bank = await this.db.query.moneyBank.findFirst({ where: { id } });
		if (!bank) return null;
		await this.db.update(moneyBank).set(data).where(eq(moneyBank.id, id));
		return this.db.query.moneyBank.findFirst({ where: { id } });
	}

	findByIdWithAccountsForDelete(id: number) {
		return this.db.query.moneyBank.findFirst({
			where: { id },
			with: { accounts: true },
		});
	}

	destroy(bank: Bank) {
		return this.db.delete(moneyBank).where(eq(moneyBank.id, bank.id));
	}

	findAllWithAccountHistoryAndPaymentTypes() {
		return this.db.query.moneyBank.findMany({
			orderBy: { name: "asc" },
			with: {
				accounts: {
					with: {
						// Latest history only
						history: { orderBy: { date: "desc" }, limit: 1 },
						paymentTypes: { with: { account: true } },
					},
				},
			},
		});
	}

	findAllWithAccountsAndPaymentTypes() {
		return this.db.query.moneyBank.findMany({
			orderBy: { name: "asc" },
			with: {
				accounts: { with: { paymentTypes: true } },
			},
		});
	}
}
