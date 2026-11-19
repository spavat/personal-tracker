import { describe, expect, it, vi } from "vitest";

import type { EntitiesRepository } from "./entities.repository.js";
import type { PortraitStorage } from "./portrait.storage.js";

import { NotFoundError } from "../common/errors.js";
import { EntitiesService } from "./entities.service.js";

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
	const service = new EntitiesService(repo as unknown as EntitiesRepository, portraits as unknown as PortraitStorage);
	return { repo, portraits, service };
}

describe("EntitiesService.save", () => {
	it("creates an entity without portrait (the pickers)", async () => {
		const { repo, portraits, service } = build();
		const entity = await service.create(CARROLL);
		expect(repo.create).toHaveBeenCalledWith({ ...CARROLL, id: expect.any(String), pictureKey: null });
		expect(portraits.upload).not.toHaveBeenCalled();
		expect(entity).toMatchObject({ ...CARROLL, picture: null });
	});

	it("keeps the portrait when left out or sent back as the server's URL", async () => {
		for (const picture of [undefined, `/images/entity/${ID}?v=old`]) {
			const { repo, portraits, service } = build({ pictureKey: OLD_KEY });
			await service.update(ID, { ...CARROLL, picture });
			expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ pictureKey: OLD_KEY }));
			expect(portraits.upload).not.toHaveBeenCalled();
			expect(portraits.deleteObject).not.toHaveBeenCalled();
		}
	});

	it("replaces the portrait and deletes the former one", async () => {
		const { repo, portraits, service } = build({ pictureKey: OLD_KEY });
		const entity = await service.update(ID, { ...CARROLL, picture: "data:image/jpeg;base64,AAAA" });
		expect(portraits.upload).toHaveBeenCalledWith(ID, "data:image/jpeg;base64,AAAA");
		expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ pictureKey: NEW_KEY }));
		expect(portraits.deleteObject).toHaveBeenCalledWith(OLD_KEY);
		expect(entity?.picture).toBe(`/images/entity/${ID}?v=new`);
	});

	it("removes the portrait", async () => {
		const { repo, portraits, service } = build({ pictureKey: OLD_KEY });
		await service.update(ID, { ...CARROLL, picture: null });
		expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ pictureKey: null }));
		expect(portraits.deleteObject).toHaveBeenCalledWith(OLD_KEY);
	});

	it("404s on an unknown entity or another kind, before uploading anything", async () => {
		for (const current of [undefined, { pictureKey: null, kind: "organization" as const }]) {
			const { repo, portraits, service } = build(current);
			await expect(
				service.update(ID, { ...CARROLL, picture: "https://example.com/p.jpg" }),
			).rejects.toBeInstanceOf(NotFoundError);
			expect(portraits.upload).not.toHaveBeenCalled();
			expect(repo.update).not.toHaveBeenCalled();
		}
	});
});
