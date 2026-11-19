import { describe, expect, it, vi } from "vitest";

import type { EntityRepository } from "./entity.repository.js";
import type { PortraitStorage } from "./portrait.storage.js";

import { asLog, makeLog } from "../test-support/fake-log.js";
import { SaveEntityUseCase } from "./entity.useCases.js";

const ID = "0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e";
const OLD_KEY = `personal-tracker/entity/${ID}.old.avif`;
const NEW_KEY = `personal-tracker/entity/${ID}.new.avif`;
const CARROLL = { kind: "person" as const, name: "Lewis Carroll", sortName: null };

function build(current?: { pictureKey: string | null; kind?: "person" | "organization" }) {
	const stored = current && { id: ID, ...CARROLL, ...current };
	const repo = {
		findById: vi.fn().mockResolvedValue(stored),
		create: vi.fn((fields) => Promise.resolve(fields)),
		update: vi.fn((fields) => Promise.resolve(fields)),
	};
	const portraits = {
		isOwnUrl: (value: string) => value.startsWith("/images/entity/"),
		upload: vi.fn().mockResolvedValue(NEW_KEY),
		deleteObject: vi.fn().mockResolvedValue(undefined),
	};
	const useCase = new SaveEntityUseCase(repo as unknown as EntityRepository, portraits as unknown as PortraitStorage);
	return { repo, portraits, useCase };
}

describe("SaveEntityUseCase", () => {
	it("creates an entity without portrait (the pickers)", async () => {
		const { repo, portraits, useCase } = build();
		const entity = await useCase.execute(CARROLL, asLog(makeLog()));
		expect(repo.create).toHaveBeenCalledWith({ ...CARROLL, id: expect.any(String), pictureKey: null });
		expect(portraits.upload).not.toHaveBeenCalled();
		expect(entity).toMatchObject({ ...CARROLL, picture: null });
	});

	it("keeps the portrait when left out or sent back as the server's URL", async () => {
		for (const picture of [undefined, `/images/entity/${ID}?v=old`]) {
			const { repo, portraits, useCase } = build({ pictureKey: OLD_KEY });
			await useCase.execute({ ...CARROLL, id: ID, picture }, asLog(makeLog()));
			expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ pictureKey: OLD_KEY }));
			expect(portraits.upload).not.toHaveBeenCalled();
			expect(portraits.deleteObject).not.toHaveBeenCalled();
		}
	});

	it("replaces the portrait and deletes the former one", async () => {
		const { repo, portraits, useCase } = build({ pictureKey: OLD_KEY });
		const entity = await useCase.execute(
			{ ...CARROLL, id: ID, picture: "data:image/jpeg;base64,AAAA" },
			asLog(makeLog()),
		);
		expect(portraits.upload).toHaveBeenCalledWith(ID, "data:image/jpeg;base64,AAAA");
		expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ pictureKey: NEW_KEY }));
		expect(portraits.deleteObject).toHaveBeenCalledWith(OLD_KEY);
		expect(entity?.picture).toBe(`/images/entity/${ID}?v=new`);
	});

	it("removes the portrait", async () => {
		const { repo, portraits, useCase } = build({ pictureKey: OLD_KEY });
		await useCase.execute({ ...CARROLL, id: ID, picture: null }, asLog(makeLog()));
		expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ pictureKey: null }));
		expect(portraits.deleteObject).toHaveBeenCalledWith(OLD_KEY);
	});

	it("is undefined for an unknown entity or another kind, before uploading anything", async () => {
		for (const current of [undefined, { pictureKey: null, kind: "organization" as const }]) {
			const { repo, portraits, useCase } = build(current);
			expect(
				await useCase.execute({ ...CARROLL, id: ID, picture: "https://example.com/p.jpg" }, asLog(makeLog())),
			).toBeUndefined();
			expect(portraits.upload).not.toHaveBeenCalled();
			expect(repo.update).not.toHaveBeenCalled();
		}
	});
});
