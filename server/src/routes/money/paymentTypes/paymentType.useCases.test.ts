import { describe, expect, it, vi } from "vitest";

import type { PaymentTypeRepository } from "./paymentType.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	CreatePaymentTypeUseCase,
	DeletePaymentTypeUseCase,
	GetPaymentTypeDetailsUseCase,
	GetPaymentTypeUseCase,
	ListPaymentTypesUseCase,
	UpdatePaymentTypeUseCase,
} from "./paymentType.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		findByIdWithTransactions: vi.fn().mockResolvedValue(null),
		findTransactionsUsingPaymentType: vi.fn().mockResolvedValue([]),
		create: vi.fn().mockResolvedValue({ id: 1 }),
		update: vi.fn().mockResolvedValue({ id: 1 }),
		destroy: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as PaymentTypeRepository;

describe("payment type CRUD use cases", () => {
	it("delegate through to the repository", () => {
		const repo = fakeRepo();
		new ListPaymentTypesUseCase(asRepo(repo)).execute(asLog(makeLog()));
		new GetPaymentTypeUseCase(asRepo(repo)).execute(1, asLog(makeLog()));
		new GetPaymentTypeDetailsUseCase(asRepo(repo)).execute(1, asLog(makeLog()));
		new CreatePaymentTypeUseCase(asRepo(repo)).execute({ name: "CB" } as any, asLog(makeLog()));
		new UpdatePaymentTypeUseCase(asRepo(repo)).execute({ id: 1, data: { name: "CB2" } as any }, asLog(makeLog()));

		expect(repo.findAll).toHaveBeenCalled();
		expect(repo.findById).toHaveBeenCalledWith(1);
		expect(repo.findByIdWithTransactions).toHaveBeenCalledWith(1);
		expect(repo.create).toHaveBeenCalledWith({ name: "CB" });
		expect(repo.update).toHaveBeenCalledWith(1, { name: "CB2" });
	});
});

describe("DeletePaymentTypeUseCase", () => {
	it("throws when the payment type does not exist", async () => {
		await expect(new DeletePaymentTypeUseCase(asRepo(fakeRepo())).execute(5, asLog(makeLog()))).rejects.toThrow(
			"Type de paiement (5) non trouvé",
		);
	});

	it("throws when transactions still use the payment type", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ id: 5 });
		repo.findTransactionsUsingPaymentType.mockResolvedValue([{}, {}]);
		await expect(new DeletePaymentTypeUseCase(asRepo(repo)).execute(5, asLog(makeLog()))).rejects.toThrow(
			"transactions are still using this payment type 2",
		);
	});

	it("destroys an unused payment type", async () => {
		const repo = fakeRepo();
		const pt = { id: 5 };
		repo.findById.mockResolvedValue(pt);
		await new DeletePaymentTypeUseCase(asRepo(repo)).execute(5, asLog(makeLog()));
		expect(repo.destroy).toHaveBeenCalledWith(pt);
	});
});
