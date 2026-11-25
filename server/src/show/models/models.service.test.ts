import { describe, expect, it, vi } from "vitest";

import type { ModelsRepository } from "./models.repository.js";

import { ModelsService } from "./models.service.js";

function fakeRepo() {
	const tx = { __tx: true };
	return {
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		runInTransaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
		deleteModelRoles: vi.fn().mockResolvedValue(undefined),
		updateModel: vi.fn().mockResolvedValue([{ id: MODEL_ID, name: "Cast A", spectacleId: SPECTACLE_ID }]),
		insertModel: vi.fn().mockResolvedValue([{ id: NEW_MODEL_ID }]),
		insertModelRole: vi.fn().mockResolvedValue([{ id: 1 }]),
		deleteModel: vi.fn().mockResolvedValue(true),
		tx,
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as ModelsRepository;
const MODEL_ID = "00000000-0000-4000-8000-000000000007";
const NEW_MODEL_ID = "00000000-0000-4000-8000-000000000042";
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000001";
const ENTITY_ID = "00000000-0000-4000-8000-000000000005";

describe("ModelsService.get", () => {
	it("delegates to the repository", () => {
		const repo = fakeRepo();
		new ModelsService(asRepo(repo)).get(MODEL_ID);
		expect(repo.findByIdWithDetails).toHaveBeenCalledWith(MODEL_ID);
	});
});

describe("ModelsService.save", () => {
	it("updates an existing model: clears roles, re-adds them, updates the model", async () => {
		const repo = fakeRepo();
		const saved = await new ModelsService(asRepo(repo)).save({
			id: MODEL_ID,
			name: "Cast A",
			roles: [{ name: "Lead", entityId: ENTITY_ID }],
		} as any);

		expect(repo.deleteModelRoles).toHaveBeenCalledWith(repo.tx, MODEL_ID);
		expect(repo.insertModelRole).toHaveBeenCalledWith(repo.tx, {
			name: "Lead",
			entityId: ENTITY_ID,
			modelId: MODEL_ID,
		});
		expect(repo.updateModel).toHaveBeenCalledWith(
			repo.tx,
			MODEL_ID,
			expect.objectContaining({ id: MODEL_ID, name: "Cast A" }),
		);
		expect(repo.insertModel).not.toHaveBeenCalled();
		expect(saved).toEqual({ id: MODEL_ID, name: "Cast A", spectacleId: SPECTACLE_ID });
	});

	it("rejects an unknown model before touching its roles", async () => {
		const repo = fakeRepo();
		repo.updateModel.mockResolvedValue([]);
		await expect(
			new ModelsService(asRepo(repo)).save({ id: MODEL_ID, name: "X", roles: [] } as any),
		).rejects.toMatchObject({ params: { resource: "model" } });
		expect(repo.deleteModelRoles).not.toHaveBeenCalled();
	});

	it("inserts a new model and its roles, a role still to cast without entity", async () => {
		const repo = fakeRepo();
		await new ModelsService(asRepo(repo)).save({
			name: "Cast B",
			roles: [{ name: "Lead" }],
		} as any);

		expect(repo.insertModel).toHaveBeenCalledWith(repo.tx, expect.objectContaining({ name: "Cast B" }));
		expect(repo.insertModelRole).toHaveBeenCalledWith(repo.tx, {
			name: "Lead",
			entityId: null,
			modelId: NEW_MODEL_ID,
		});
	});
});

describe("ModelsService.delete", () => {
	it("removes the model roles then the model, in a transaction", async () => {
		const repo = fakeRepo();
		await new ModelsService(asRepo(repo)).delete(MODEL_ID);
		expect(repo.deleteModelRoles).toHaveBeenCalledWith(repo.tx, MODEL_ID);
		expect(repo.deleteModel).toHaveBeenCalledWith(repo.tx, MODEL_ID);
	});
});
