import { describe, expect, it, vi } from "vitest";

import type { ModelRepository } from "./model.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { DeleteModelUseCase, GetModelUseCase, SaveModelUseCase } from "./model.useCases";

function fakeRepo() {
	const tx = { __tx: true };
	return {
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		runInTransaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
		deleteModelRoles: vi.fn().mockResolvedValue(undefined),
		updateModel: vi.fn().mockResolvedValue(undefined),
		insertModel: vi.fn().mockResolvedValue([{ id: 42 }]),
		insertArtist: vi.fn().mockResolvedValue([{ id: 99 }]),
		insertModelRole: vi.fn().mockResolvedValue([{ id: 1 }]),
		deleteModel: vi.fn().mockResolvedValue(undefined),
		tx,
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as ModelRepository;

describe("GetModelUseCase", () => {
	it("delegates to the repository", () => {
		const repo = fakeRepo();
		new GetModelUseCase(asRepo(repo)).execute(3, asLog(makeLog()));
		expect(repo.findByIdWithDetails).toHaveBeenCalledWith(3);
	});
});

describe("SaveModelUseCase", () => {
	it("updates an existing model: clears roles, re-adds them, updates the model", async () => {
		const repo = fakeRepo();
		await new SaveModelUseCase(asRepo(repo)).execute(
			{
				id: 7,
				name: "Cast A",
				roles: [{ name: "Lead", artistId: 5 }],
			} as any,
			asLog(makeLog()),
		);

		expect(repo.deleteModelRoles).toHaveBeenCalledWith(repo.tx, 7);
		expect(repo.insertModelRole).toHaveBeenCalledWith(repo.tx, { name: "Lead", artistId: 5, modelId: 7 });
		expect(repo.updateModel).toHaveBeenCalledWith(repo.tx, 7, expect.objectContaining({ id: 7, name: "Cast A" }));
		expect(repo.insertModel).not.toHaveBeenCalled();
	});

	it("inserts a new model and creates a missing artist for a role", async () => {
		const repo = fakeRepo();
		await new SaveModelUseCase(asRepo(repo)).execute(
			{
				name: "Cast B",
				roles: [{ name: "Lead", artist: "New Artist" }],
			} as any,
			asLog(makeLog()),
		);

		expect(repo.insertModel).toHaveBeenCalledWith(repo.tx, expect.objectContaining({ name: "Cast B" }));
		expect(repo.insertArtist).toHaveBeenCalledWith(repo.tx, "New Artist");
		expect(repo.insertModelRole).toHaveBeenCalledWith(repo.tx, {
			name: "Lead",
			artist: "New Artist",
			artistId: 99,
			modelId: 42,
		});
	});
});

describe("DeleteModelUseCase", () => {
	it("removes the model roles then the model, in a transaction", async () => {
		const repo = fakeRepo();
		expect(await new DeleteModelUseCase(asRepo(repo)).execute(7, asLog(makeLog()))).toEqual({ ok: true });
		expect(repo.deleteModelRoles).toHaveBeenCalledWith(repo.tx, 7);
		expect(repo.deleteModel).toHaveBeenCalledWith(repo.tx, 7);
	});
});
