import { describe, expect, it, vi } from "vitest";

import type { AccountRepository } from "./account.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	CreateAccountUseCase,
	DeleteAccountUseCase,
	GetAccountDetailsUseCase,
	GetAccountUseCase,
	ListAccountsUseCase,
	UpdateAccountUseCase,
} from "./account.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		findByIdWithRelationsForDelete: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue({ id: 1 }),
		update: vi.fn().mockResolvedValue({ id: 1 }),
		destroy: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as AccountRepository;

describe("account CRUD use cases", () => {
	it("delegate straight through to the repository", () => {
		const repo = fakeRepo();
		new ListAccountsUseCase(asRepo(repo)).execute(asLog(makeLog()));
		new GetAccountUseCase(asRepo(repo)).execute(1, asLog(makeLog()));
		new GetAccountDetailsUseCase(asRepo(repo)).execute(1, asLog(makeLog()));
		new CreateAccountUseCase(asRepo(repo)).execute({ name: "Checking" } as any, asLog(makeLog()));
		new UpdateAccountUseCase(asRepo(repo)).execute({ id: 1, data: { name: "Renamed" } as any }, asLog(makeLog()));

		expect(repo.findAll).toHaveBeenCalled();
		expect(repo.findById).toHaveBeenCalledWith(1);
		expect(repo.findByIdWithDetails).toHaveBeenCalledWith(1);
		expect(repo.create).toHaveBeenCalledWith({ name: "Checking" });
		expect(repo.update).toHaveBeenCalledWith(1, { name: "Renamed" });
	});
});

describe("DeleteAccountUseCase", () => {
	it("throws when the account does not exist", async () => {
		const repo = fakeRepo();
		await expect(new DeleteAccountUseCase(asRepo(repo)).execute(7, asLog(makeLog()))).rejects.toThrow(
			"Compte (7) non trouvé",
		);
	});

	it("refuses to delete an account that still has history", async () => {
		const repo = fakeRepo();
		repo.findByIdWithRelationsForDelete.mockResolvedValue({ history: [{}], paymentTypes: [] });
		await expect(new DeleteAccountUseCase(asRepo(repo)).execute(7, asLog(makeLog()))).rejects.toThrow(
			"possède un historique",
		);
		expect(repo.destroy).not.toHaveBeenCalled();
	});

	it("refuses to delete an account that still has payment types", async () => {
		const repo = fakeRepo();
		repo.findByIdWithRelationsForDelete.mockResolvedValue({ history: [], paymentTypes: [{}] });
		await expect(new DeleteAccountUseCase(asRepo(repo)).execute(7, asLog(makeLog()))).rejects.toThrow(
			"moyens de payments",
		);
	});

	it("destroys an account with no relations", async () => {
		const repo = fakeRepo();
		const account = { history: [], paymentTypes: [] };
		repo.findByIdWithRelationsForDelete.mockResolvedValue(account);
		await new DeleteAccountUseCase(asRepo(repo)).execute(7, asLog(makeLog()));
		expect(repo.destroy).toHaveBeenCalledWith(account);
	});
});
