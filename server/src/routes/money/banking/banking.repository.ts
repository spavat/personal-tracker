import type { FastifyInstance } from "fastify";

import { and, eq, inArray, lt } from "drizzle-orm";

import {
	moneyBankConnection,
	moneyBankConnectionAccount,
	moneyBankTransaction,
	moneyTransaction,
} from "../../../db/schema";

type Db = FastifyInstance["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type NewConnection = typeof moneyBankConnection.$inferInsert;
type NewConnectionAccount = typeof moneyBankConnectionAccount.$inferInsert;
type NewBankTransaction = typeof moneyBankTransaction.$inferInsert;

export class BankingRepository {
	constructor(private db: Db) {}

	runInTransaction<T>(fn: (t: Tx) => Promise<T>) {
		return this.db.transaction(fn);
	}

	// CONNECTIONS
	listConnections() {
		return this.db.query.moneyBankConnection.findMany({
			orderBy: { id: "asc" },
			with: { accounts: { orderBy: { id: "asc" } } },
		});
	}

	findConnection(id: number) {
		return this.db.query.moneyBankConnection.findFirst({ where: { id }, with: { accounts: true } });
	}

	findConnectionByState(authState: string) {
		return this.db.query.moneyBankConnection.findFirst({ where: { authState } });
	}

	async createConnection(data: NewConnection) {
		const [created] = await this.db.insert(moneyBankConnection).values(data).returning();
		return created;
	}

	updateConnection(id: number, data: Partial<NewConnection>) {
		return this.db.update(moneyBankConnection).set(data).where(eq(moneyBankConnection.id, id));
	}

	deleteConnection(id: number) {
		return this.db.delete(moneyBankConnection).where(eq(moneyBankConnection.id, id));
	}

	// CONNECTION ACCOUNTS
	findConnectionAccount(id: number) {
		return this.db.query.moneyBankConnectionAccount.findFirst({ where: { id } });
	}

	createConnectionAccount(data: NewConnectionAccount) {
		return this.db.insert(moneyBankConnectionAccount).values(data);
	}

	updateConnectionAccount(id: number, data: Partial<NewConnectionAccount>) {
		return this.db.update(moneyBankConnectionAccount).set(data).where(eq(moneyBankConnectionAccount.id, id));
	}

	findAccountByIban(iban: string) {
		return this.db.query.moneyAccount.findFirst({ where: { iban } });
	}

	findAccount(id: number) {
		return this.db.query.moneyAccount.findFirst({ where: { id } });
	}

	// INBOX
	async findKnownExternalIds(externalIds: string[]) {
		if (!externalIds.length) return new Set<string>();
		const [transactions, inbox] = await Promise.all([
			this.db
				.select({ externalId: moneyTransaction.externalId })
				.from(moneyTransaction)
				.where(inArray(moneyTransaction.externalId, externalIds)),
			this.db
				.select({ externalId: moneyBankTransaction.externalId })
				.from(moneyBankTransaction)
				.where(inArray(moneyBankTransaction.externalId, externalIds)),
		]);
		return new Set([...transactions, ...inbox].map((row) => row.externalId!));
	}

	insertBankTransactions(rows: NewBankTransaction[]) {
		if (!rows.length) return Promise.resolve();
		return this.db.insert(moneyBankTransaction).values(rows).onConflictDoNothing();
	}

	purgeIgnored(before: string) {
		return this.db
			.delete(moneyBankTransaction)
			.where(and(eq(moneyBankTransaction.ignored, true), lt(moneyBankTransaction.bookingDate, before)));
	}

	listInbox() {
		return this.db.query.moneyBankTransaction.findMany({
			where: { ignored: false },
			orderBy: { bookingDate: "desc", id: "desc" },
			with: { connectionAccount: { with: { account: { with: { paymentTypes: true } } } } },
		});
	}

	countInbox() {
		return this.db.$count(moneyBankTransaction, eq(moneyBankTransaction.ignored, false));
	}

	findBankTransaction(id: number) {
		return this.db.query.moneyBankTransaction.findFirst({
			where: { id },
			with: { connectionAccount: { with: { account: { with: { paymentTypes: true } } } } },
		});
	}

	deleteBankTransaction(id: number, options?: { transaction: Tx }) {
		return (options?.transaction ?? this.db).delete(moneyBankTransaction).where(eq(moneyBankTransaction.id, id));
	}

	ignoreBankTransaction(id: number) {
		return this.db.update(moneyBankTransaction).set({ ignored: true }).where(eq(moneyBankTransaction.id, id));
	}

	// MATCHING
	findMatchCandidates(accountId: number, from: string, to: string) {
		return this.db.query.moneyTransaction.findMany({
			where: {
				parentId: { isNull: true },
				externalId: { isNull: true },
				date: { gte: from, lte: to },
				paymentType: { accountId },
			},
			orderBy: { date: "asc" },
			with: { paymentType: true, category: true },
		});
	}

	findTransaction(id: number) {
		return this.db.query.moneyTransaction.findFirst({ where: { id }, with: { paymentType: true } });
	}

	linkTransaction(id: number, data: { externalId: string; bankLabel: string }, options?: { transaction: Tx }) {
		return (options?.transaction ?? this.db).update(moneyTransaction).set(data).where(eq(moneyTransaction.id, id));
	}
}
