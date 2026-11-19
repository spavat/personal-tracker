import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../common/errors.js";
import { GameImagesStorage } from "./game-images.storage.js";
import { GameRepository } from "./game.repository.js";
import { GameService } from "./game.service.js";

const GAME = "11111111-1111-4111-8111-111111111111";

describe("GameService", () => {
	let service: GameService;
	const repo = {
		findAll: vi.fn(),
		findPlaysInRange: vi.fn(),
		findById: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		pushPlay: vi.fn(),
		updatePlay: vi.fn(),
		deletePlay: vi.fn(),
	};
	const images = {
		isOwnUrl: (value: string) => value.startsWith("/images/game/"),
		uploadFromSource: vi.fn(),
		resolveImages: (game: object) => game,
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		images.uploadFromSource.mockImplementation(async (id: string, field: string) => `key/${id}.${field}`);
		const ref = await Test.createTestingModule({
			providers: [
				GameService,
				{ provide: GameRepository, useValue: repo },
				{ provide: GameImagesStorage, useValue: images },
			],
		}).compile();
		service = ref.get(GameService);
	});

	it("listGames defaults the sort and normalises the search", async () => {
		repo.findAll.mockResolvedValue([]);
		await service.listGames({} as never);
		expect(repo.findAll).toHaveBeenCalledWith({ search: "", sortField: "name", sortDirection: "asc" });
	});

	describe("getGame", () => {
		it("sorts the plays most recent first", async () => {
			repo.findById.mockResolvedValue({
				_id: "mongo",
				id: GAME,
				plays: [{ date: "2024-01-01" }, { date: "2024-03-01" }],
			});

			const game = await service.getGame(GAME);

			expect(game).not.toHaveProperty("_id");
			expect(game.plays.map((p) => p.date)).toEqual(["2024-03-01", "2024-01-01"]);
		});

		it("rejects with NotFoundError for an unknown game", async () => {
			repo.findById.mockResolvedValue(null);
			await expect(service.getGame(GAME)).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("save", () => {
		it("inserts a new game with its pictures stored and its first play", async () => {
			await service.save({
				game: { name: "Celeste", developper: "EXOK", editor: "EXOK", capsule: "https://cdn/c.jpg", links: [] },
				play: { date: "2026-11-01", duration: 30 },
			} as never);

			const inserted = repo.insert.mock.calls[0][0];
			expect(images.uploadFromSource).toHaveBeenCalledWith(inserted.id, "capsule", "https://cdn/c.jpg");
			expect(inserted).toMatchObject({ name: "Celeste", capsule: `key/${inserted.id}.capsule` });
			expect(inserted).not.toHaveProperty("links"); // empty list left out
			expect(inserted.plays).toEqual([expect.objectContaining({ date: "2026-11-01", id: expect.any(String) })]);
		});

		it("keeps a stored picture sent back with its proxy URL, and drops an emptied one", async () => {
			repo.findById.mockResolvedValue({ id: GAME, capsule: "stored/capsule.avif", header: "stored/header.avif" });

			await service.save({
				game: { id: GAME, name: "Celeste", capsule: `/images/game/${GAME}/capsule`, header: "" },
			} as never);

			expect(images.uploadFromSource).not.toHaveBeenCalled();
			const [, saved] = repo.update.mock.calls[0];
			expect(saved.capsule).toBe("stored/capsule.avif");
			expect(saved).not.toHaveProperty("header");
		});

		it("an edited synced play becomes a manual one", async () => {
			await service.save({
				gameId: GAME,
				play: { id: "p1", date: "2026-11-01", duration: 40, auto: true },
			} as never);
			expect(repo.updatePlay).toHaveBeenCalledWith(GAME, expect.objectContaining({ id: "p1", auto: false }));
		});

		it("adds a play to an existing game", async () => {
			await service.save({ gameId: GAME, play: { date: "2026-11-01", duration: 40 } } as never);
			expect(repo.pushPlay).toHaveBeenCalledWith(
				GAME,
				expect.objectContaining({ id: expect.any(String), duration: 40 }),
			);
		});
	});
});
