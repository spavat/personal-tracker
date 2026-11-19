import type { CreateAccountBody, UpdateAccountBody } from "@personal-tracker/shared/money";
import type { FastifyInstance } from "fastify";

import { eq } from "drizzle-orm";

import { moneyAccount } from "../../../db/schema";

type Account = typeof moneyAccount.$inferSelect;

export class AccountRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll() {
		return this.db.query.moneyAccount.findMany({ orderBy: { name: "asc" } });
	}

	// `?? null`: an `undefined` result would be sent as an empty body
	async findById(id: number) {
		return (await this.db.query.moneyAccount.findFirst({ where: { id } })) ?? null;
	}

	async findByIdWithDetails(id: number) {
		return (
			(await this.db.query.moneyAccount.findFirst({
				where: { id },
				with: {
					history: { orderBy: { date: "asc" } },
					paymentTypes: true,
				},
			})) ?? null
		);
	}

	findByIdWithRelationsForDelete(id: number) {
		return this.db.query.moneyAccount.findFirst({
			where: { id },
			with: { history: true, paymentTypes: true },
		});
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

	destroy(account: Account) {
		return this.db.delete(moneyAccount).where(eq(moneyAccount.id, account.id));
	}
}
