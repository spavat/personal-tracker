import type { CreateBankBody, UpdateBankBody } from "@personal-tracker/shared/money";

import { Injectable, Logger } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { TransactionsRepository } from "../transactions/transactions.repository.js";
import { BanksRepository } from "./banks.repository.js";

@Injectable()
export class BanksService {
	private readonly logger = new Logger(BanksService.name);
	constructor(
		private readonly repo: BanksRepository,
		// exported by TransactionsModule
		private readonly transactionsRepo: TransactionsRepository,
	) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	async get(id: number) {
		this.logger.log("get");
		return (await this.repo.findById(id)) ?? notFound();
	}

	create(data: CreateBankBody) {
		this.logger.log("create");
		return this.repo.create(data);
	}

	async update(id: number, data: UpdateBankBody) {
		this.logger.log("update");
		return (await this.repo.update(id, data)) ?? notFound();
	}

	async delete(id: number) {
		this.logger.log("delete");
		const bank = (await this.repo.findByIdWithAccountsForDelete(id)) ?? notFound();
		if (bank.accounts.length) {
			throw new ConflictError("has_dependents", "the bank has accounts", {
				resource: "bank",
				dependent: "accounts",
				count: bank.accounts.length,
			});
		}
		await this.repo.destroy(id);
	}

	tree() {
		this.logger.log("tree");
		return this.repo.findAllWithAccountsAndPaymentTypes();
	}

	// Each account's latest history amount, plus the transactions since that history date
	async overview() {
		this.logger.log("overview");
		const banks = await this.repo.findAllWithAccountHistoryAndPaymentTypes();

		const latestHistoryDateByAccount = new Map<number, string>();
		let minDate = "9999-99-99";
		for (const bank of banks) {
			for (const account of bank.accounts) {
				const historyDate = account.history[0]?.date;
				if (!historyDate) continue;
				latestHistoryDateByAccount.set(account.id, historyDate);
				if (historyDate < minDate) {
					minDate = historyDate;
				}
			}
		}

		const transactions = await this.transactionsRepo.findAllForBanksOverview({ from: minDate });

		let transactionsUsed = 0;
		const deltaByAccount = new Map<number, number>();
		const addToAccount = (accountId: number | undefined, date: string, amount: number | null) => {
			if (accountId === undefined) return;
			const historyDate = latestHistoryDateByAccount.get(accountId);
			// an account without history is never updated (as in the Fastify server: `date >= undefined` is false)
			if (historyDate === undefined || date < historyDate) return;
			transactionsUsed++;
			deltaByAccount.set(accountId, (deltaByAccount.get(accountId) ?? 0) + (amount ?? 0));
		};
		for (const transaction of transactions) {
			if (transaction.informative) continue;
			const date = transaction.date ?? "";
			addToAccount(transaction.paymentType?.account?.id, date, transaction.amount);
			for (const child of transaction.children) {
				addToAccount(child.paymentType?.account?.id, date, child.amount);
			}
		}

		for (const bank of banks) {
			for (const account of bank.accounts) {
				const delta = deltaByAccount.get(account.id);
				if (account.history.length > 0 && delta) {
					account.history[0].amount = (account.history[0].amount ?? 0) + delta;
				}
			}
		}
		this.logger.log(
			`overview from ${minDate}: ${transactions.length} transactions queried, ${transactionsUsed} used`,
		);
		return banks;
	}
}

function notFound(): never {
	throw new NotFoundError("bank");
}
