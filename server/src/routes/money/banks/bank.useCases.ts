import type { CreateBankBody, UpdateBankBody } from "@personal-tracker/shared/money";

import { FastifyBaseLogger } from "fastify";

import type { TransactionRepository } from "../transactions/transaction.repository";
import type { BankRepository } from "./bank.repository";

export class ListBanksUseCase {
	constructor(private repo: BankRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListBanksUseCase.execute");
		return this.repo.findAll();
	}
}

export class GetBankUseCase {
	constructor(private repo: BankRepository) {}

	execute(id: number, log: FastifyBaseLogger) {
		log.info("GetBankUseCase.execute");
		return this.repo.findById(id);
	}
}

export class CreateBankUseCase {
	constructor(private repo: BankRepository) {}

	execute(data: CreateBankBody, log: FastifyBaseLogger) {
		log.info("CreateBankUseCase.execute");
		return this.repo.create(data);
	}
}

export class UpdateBankUseCase {
	constructor(private repo: BankRepository) {}

	execute({ id, data }: { id: number; data: UpdateBankBody }, log: FastifyBaseLogger) {
		log.info("UpdateBankUseCase.execute");
		return this.repo.update(id, data);
	}
}

export class DeleteBankUseCase {
	constructor(private repo: BankRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("DeleteBankUseCase.execute");
		const bankToDelete = await this.repo.findByIdWithAccountsForDelete(id);
		if (!bankToDelete) {
			throw new Error(`Banque (${id}) non trouvée`);
		}

		const accounts = bankToDelete.accounts ?? [];
		if (accounts.length) {
			throw new Error(`La banque (${id}) possède encore des comptes (${accounts.length})`);
		}

		return this.repo.destroy(bankToDelete);
	}
}

export class GetBanksOverviewUseCase {
	constructor(
		private repo: BankRepository,
		private transactionRepo: TransactionRepository,
	) {}

	async execute(log: FastifyBaseLogger) {
		log.info("GetBanksOverviewUseCase.execute");
		let transactionsCount = 0;
		const minDateFromAccount = new Map();

		const banks = await this.repo.findAllWithAccountHistoryAndPaymentTypes();

		let maxDate = "";
		let minDate = "9999-99-99";
		banks.forEach((bank) => {
			(bank.accounts ?? []).forEach((account) => {
				const history = account.history ?? [];
				const historyDate = history[0]?.date ?? "";
				if (history.length) {
					minDateFromAccount.set(account.id, historyDate);
				}
				if (history.length > 0 && historyDate > maxDate) {
					maxDate = historyDate;
				}
				if (history.length > 0 && historyDate < minDate) {
					log.info(
						{ accountId: account.id, accountName: account.name, minDate: historyDate },
						"Account with the oldest date of history",
					);
					minDate = historyDate;
				}
			});
		});

		const from = minDate;
		const transactions = await this.transactionRepo.findAllForBanksOverview({ from });

		const updatingData: Record<string, number> = {};
		transactions.forEach((transaction) => {
			const considerationDate = transaction.date ?? "";
			if (!transaction.informative) {
				if (transaction.paymentType?.account) {
					const accountKey = `${transaction.paymentType.account.id}`;
					if (considerationDate >= minDateFromAccount.get(transaction.paymentType.account.id)) {
						transactionsCount++;
						if (!updatingData[accountKey]) {
							updatingData[accountKey] = 0;
						}
						updatingData[accountKey] += transaction.amount ?? 0;
					}
				}

				(transaction.children ?? []).forEach((child) => {
					if (child.paymentType?.account) {
						const accountKey = `${child.paymentType.account.id}`;
						if (considerationDate >= minDateFromAccount.get(child.paymentType.account.id)) {
							transactionsCount++;
							if (!updatingData[accountKey]) {
								updatingData[accountKey] = 0;
							}
							updatingData[accountKey] += child.amount ?? 0;
						}
					}
				});
			}
		});

		banks.forEach((bank) => {
			(bank.accounts ?? []).forEach((account) => {
				const history = account.history ?? [];
				if (history.length > 0 && updatingData[account.id]) {
					history[0].amount = (history[0].amount ?? 0) + updatingData[account.id];
				}
			});
		});
		log.info(
			{ from, transactionsQueried: transactions.length, transactionsUsed: transactionsCount },
			"Built overview",
		);
		return banks;
	}
}

export class GetBanksTreeUseCase {
	constructor(private repo: BankRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("GetBanksTreeUseCase.execute");
		return this.repo.findAllWithAccountsAndPaymentTypes();
	}
}
