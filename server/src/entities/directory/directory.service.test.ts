import { describe, expect, it, vi } from "vitest";

import type { BroadcastRepository } from "../../broadcast/broadcast.repository.js";
import type { BookRepository } from "../../reading-book/book.repository.js";
import type { ArtistsRepository } from "../../show/artists/artists.repository.js";
import type { EntitiesRepository, EntityFields } from "../entities.repository.js";
import type { PortraitStorage } from "../portrait.storage.js";

import { NotFoundError } from "../../common/errors.js";
import { DirectoryService } from "./directory.service.js";

const KEEP: EntityFields = { id: "keep", kind: "person", name: "Émile Zola", sortName: null, pictureKey: "keep.avif" };
const REMOVE = {
	id: "remove",
	kind: "person" as const,
	name: "E. Zola",
	sortName: "Zola, E.",
	pictureKey: "remove.avif",
};

function build(entities: Record<string, EntityFields | undefined>) {
	const steps: string[] = [];
	const tx = { tx: true };
	const step = (name: string) => vi.fn(async () => void steps.push(name));
	const repo = {
		findById: vi.fn(async (id: string) => entities[id]),
		findAll: vi.fn(async () => Object.values(entities).filter(Boolean)),
		runInTransaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
		absorb: step("absorb"),
	};
	const artists = { moveEntityCredits: step("show"), countEntityCredits: vi.fn(async () => new Map()) };
	const books = { moveEntityCredits: step("books"), findEntityBookIds: vi.fn(async () => []) };
	const broadcast = {
		moveEntityCredits: step("broadcast"),
		findEntityCreditIds: vi.fn(async () => ({ programs: [], episodes: [] })),
	};
	const portraits = { deleteObject: vi.fn(async () => undefined) };
	const service = new DirectoryService(
		repo as unknown as EntitiesRepository,
		artists as unknown as ArtistsRepository,
		books as unknown as BookRepository,
		broadcast as unknown as BroadcastRepository,
		portraits as unknown as PortraitStorage,
	);
	return { service, repo, artists, books, broadcast, portraits, steps, tx };
}

describe("DirectoryService.merge", () => {
	it("moves every module's credits, then absorbs the secondary, in one transaction", async () => {
		const { service, repo, artists, steps, tx } = build({ keep: KEEP, remove: REMOVE });
		const merged = await service.merge({ keepId: "keep", removeId: "remove" });

		expect(steps).toEqual(["show", "books", "broadcast", "absorb"]);
		expect(artists.moveEntityCredits).toHaveBeenCalledWith(tx, "remove", "keep");
		expect(repo.absorb).toHaveBeenCalledWith(tx, KEEP, REMOVE);
		expect(merged).toMatchObject({ id: "keep", name: "Émile Zola" });
	});

	it("deletes the secondary's portrait when the main one keeps its own", async () => {
		const { service, portraits } = build({ keep: KEEP, remove: REMOVE });
		await service.merge({ keepId: "keep", removeId: "remove" });
		expect(portraits.deleteObject).toHaveBeenCalledWith("remove.avif");
	});

	it("keeps the secondary's portrait when the main one has none (it takes it)", async () => {
		const { service, portraits } = build({ keep: { ...KEEP, pictureKey: null }, remove: REMOVE });
		await service.merge({ keepId: "keep", removeId: "remove" });
		expect(portraits.deleteObject).not.toHaveBeenCalled();
	});

	it("404s on an unknown entity, before changing anything", async () => {
		const { service, repo } = build({ keep: KEEP });
		await expect(service.merge({ keepId: "keep", removeId: "remove" })).rejects.toBeInstanceOf(NotFoundError);
		expect(repo.runInTransaction).not.toHaveBeenCalled();
	});
});
