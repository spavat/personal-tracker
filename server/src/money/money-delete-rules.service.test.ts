import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "../common/errors.js";
import { AccountsRepository } from "./accounts/accounts.repository.js";
import { AccountsService } from "./accounts/accounts.service.js";
import { PaymentTypesRepository } from "./payment-types/payment-types.repository.js";
import { PaymentTypesService } from "./payment-types/payment-types.service.js";

async function accounts(found: unknown) {
	const repo = { findByIdWithRelationsForDelete: vi.fn().mockResolvedValue(found), destroy: vi.fn() };
	const ref = await Test.createTestingModule({
		providers: [AccountsService, { provide: AccountsRepository, useValue: repo }],
	}).compile();
	return { service: ref.get(AccountsService), repo };
}

async function paymentTypes(found: unknown, transactions: unknown[] = []) {
	const repo = {
		findById: vi.fn().mockResolvedValue(found),
		findTransactionsUsingPaymentType: vi.fn().mockResolvedValue(transactions),
		destroy: vi.fn(),
	};
	const ref = await Test.createTestingModule({
		providers: [PaymentTypesService, { provide: PaymentTypesRepository, useValue: repo }],
	}).compile();
	return { service: ref.get(PaymentTypesService), repo };
}

describe("AccountsService.delete", () => {
	it("rejects with NotFoundError for an unknown account", async () => {
		const { service } = await accounts(undefined);
		await expect(service.delete(1)).rejects.toBeInstanceOf(NotFoundError);
	});

	it("refuses an account with history or payment types", async () => {
		for (const account of [
			{ id: 1, history: [{}], paymentTypes: [] },
			{ id: 1, history: [], paymentTypes: [{}] },
		]) {
			const { service, repo } = await accounts(account);
			await expect(service.delete(1)).rejects.toBeInstanceOf(ConflictError);
			expect(repo.destroy).not.toHaveBeenCalled();
		}
	});

	it("deletes an account with neither", async () => {
		const { service, repo } = await accounts({ id: 1, history: [], paymentTypes: [] });
		expect(await service.delete(1)).toEqual({ deleted: true });
		expect(repo.destroy).toHaveBeenCalledWith(1);
	});
});

describe("PaymentTypesService.delete", () => {
	it("rejects with NotFoundError for an unknown payment type", async () => {
		const { service } = await paymentTypes(undefined);
		await expect(service.delete(1)).rejects.toBeInstanceOf(NotFoundError);
	});

	it("refuses a payment type still used by transactions", async () => {
		const { service, repo } = await paymentTypes({ id: 1 }, [{}]);
		await expect(service.delete(1)).rejects.toBeInstanceOf(ConflictError);
		expect(repo.destroy).not.toHaveBeenCalled();
	});

	it("deletes an unused payment type", async () => {
		const { service, repo } = await paymentTypes({ id: 1 });
		expect(await service.delete(1)).toEqual({ deleted: true });
		expect(repo.destroy).toHaveBeenCalledWith(1);
	});
});
