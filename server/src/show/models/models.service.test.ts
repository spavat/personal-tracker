import { describe, expect, it, vi } from "vitest";

import type { ModelsRepository } from "./models.repository.js";

import { ModelsService } from "./models.service.js";

function fakeRepo() {
	const tx = { __tx: true };
	return {
		findByIdWithDetails: vi.fn().mockResolvedValue(null),
		runInTransaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
		deleteModelRoles: vi.fn().mockResolvedValue(undefined),
		updateModel: vi.fn().mockResolvedValue([{ id: 7, name: "Cast A", spectacleId: 1 }]),
		insertModel: vi.fn().mockResolvedValue([{ id: 42 }]),
		insertArtist: vi.fn().mockResolvedValue([{ id: 99 }]),
		insertModelRole: vi.fn().mockResolvedValue([{ id: 1 }]),
		deleteModel: vi.fn().mockResolvedValue(true),
		tx,
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as ModelsRepository;

describe("ModelsService.get", () => {
	it("delegates to the repository", () => {
		const repo = fakeRepo();
		new ModelsService(asRepo(repo)).get(3);
		expect(repo.findByIdWithDetails).toHaveBeenCalledWith(3);
	});
});

describe("ModelsService.save", () => {
	it("updates an existing model: clears roles, re-adds them, updates the model", async () => {
		const repo = fakeRepo();
		const saved = await new ModelsService(asRepo(repo)).save({
			id: 7,
			name: "Cast A",
			roles: [{ name: "Lead", artistId: 5 }],
		} as any);

		expect(repo.deleteModelRoles).toHaveBeenCalledWith(repo.tx, 7);
		expect(repo.insertModelRole).toHaveBeenCalledWith(repo.tx, { name: "Lead", artistId: 5, modelId: 7 });
		expect(repo.updateModel).toHaveBeenCalledWith(repo.tx, 7, expect.objectContaining({ id: 7, name: "Cast A" }));
		expect(repo.insertModel).not.toHaveBeenCalled();
		expect(saved).toEqual({ id: 7, name: "Cast A", spectacleId: 1 });
	});

	it("rejects an unknown model before touching its roles", async () => {
		const repo = fakeRepo();
		repo.updateModel.mockResolvedValue([]);
		await expect(
			new ModelsService(asRepo(repo)).save({ id: 7, name: "X", roles: [] } as any),
		).rejects.toMatchObject({ params: { resource: "model" } });
		expect(repo.deleteModelRoles).not.toHaveBeenCalled();
	});

	it("inserts a new model and creates a missing artist for a role", async () => {
		const repo = fakeRepo();
		await new ModelsService(asRepo(repo)).save({
			name: "Cast B",
			roles: [{ name: "Lead", artist: "New Artist" }],
		} as any);

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

describe("ModelsService.delete", () => {
	it("removes the model roles then the model, in a transaction", async () => {
		const repo = fakeRepo();
		await new ModelsService(asRepo(repo)).delete(7);
		expect(repo.deleteModelRoles).toHaveBeenCalledWith(repo.tx, 7);
		expect(repo.deleteModel).toHaveBeenCalledWith(repo.tx, 7);
	});
});
