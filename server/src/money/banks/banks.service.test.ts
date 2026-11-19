import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { TransactionsRepository } from "../transactions/transactions.repository.js";
import { BanksRepository } from "./banks.repository.js";
import { BanksService } from "./banks.service.js";

describe("BanksService", () => {
	let service: BanksService;
	const repo = {
		findByIdWithAccountsForDelete: vi.fn(),
		destroy: vi.fn(),
		findAllWithAccountHistoryAndPaymentTypes: vi.fn(),
	};
	const transactionsRepo = { findAllForBanksOverview: vi.fn() };

	beforeEach(async () => {
		vi.resetAllMocks();
		const ref = await Test.createTestingModule({
			providers: [
				BanksService,
				{ provide: BanksRepository, useValue: repo },
				{ provide: TransactionsRepository, useValue: transactionsRepo },
			],
		}).compile();
		service = ref.get(BanksService);
	});

	describe("delete", () => {
		it("rejects with NotFoundError for an unknown bank", async () => {
			repo.findByIdWithAccountsForDelete.mockResolvedValue(undefined);
			await expect(service.delete(1)).rejects.toBeInstanceOf(NotFoundError);
		});

		it("refuses to delete a bank that still has accounts", async () => {
			repo.findByIdWithAccountsForDelete.mockResolvedValue({ id: 1, accounts: [{ id: 10 }] });
			await expect(service.delete(1)).rejects.toBeInstanceOf(ConflictError);
			expect(repo.destroy).not.toHaveBeenCalled();
		});

		it("deletes a bank with no accounts", async () => {
			repo.findByIdWithAccountsForDelete.mockResolvedValue({ id: 1, accounts: [] });
			expect(await service.delete(1)).toEqual({ deleted: true });
			expect(repo.destroy).toHaveBeenCalledWith(1);
		});
	});

	describe("overview", () => {
		it("adds the transactions since each account's latest history onto that history amount", async () => {
			repo.findAllWithAccountHistoryAndPaymentTypes.mockResolvedValue([
				{
					accounts: [
						{ id: 10, history: [{ date: "2024-03-01", amount: 100 }] },
						{ id: 20, history: [{ date: "2024-01-01", amount: 500 }] },
						{ id: 30, history: [] }, // no history: never updated
					],
				},
			]);
			const account = (id: number) => ({ paymentType: { account: { id } } });
			transactionsRepo.findAllForBanksOverview.mockResolvedValue([
				// before account 10's history: ignored for 10, counted for 20 (child)
				{ date: "2024-02-01", amount: 1, ...account(10), children: [{ amount: -20, ...account(20) }] },
				{ date: "2024-03-05", amount: 50, ...account(10), children: [] },
				{ date: "2024-03-06", amount: 999, informative: true, ...account(10), children: [] },
				{ date: "2024-03-07", amount: 7, ...account(30), children: [] },
			]);

			const [bank] = await service.overview();

			expect(transactionsRepo.findAllForBanksOverview).toHaveBeenCalledWith({ from: "2024-01-01" });
			expect(bank.accounts.map((a) => a.history[0]?.amount)).toEqual([150, 480, undefined]);
		});
	});
});
