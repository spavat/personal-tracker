import type { CreateBankBody, UpdateBankBody } from "@personal-tracker/shared/money";

import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DRIZZLE } from "../../database/database.tokens.js";
import { Drizzle } from "../../database/drizzle.js";
import { moneyBank } from "../../database/schema.js";

@Injectable()
export class BanksRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	findAll() {
		return this.db.query.moneyBank.findMany({ orderBy: { name: "asc" } });
	}

	findById(id: number) {
		return this.db.query.moneyBank.findFirst({
			where: { id },
			with: { accounts: { with: { paymentTypes: true } } },
		});
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
		return this.db.query.moneyBank.findFirst({ where: { id }, with: { accounts: true } });
	}

	destroy(id: number) {
		return this.db.delete(moneyBank).where(eq(moneyBank.id, id));
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
			with: { accounts: { with: { paymentTypes: true } } },
		});
	}
}
