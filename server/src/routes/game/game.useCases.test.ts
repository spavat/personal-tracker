import { describe, expect, it, vi } from "vitest";

import type { GameRepository } from "./game.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import {
	DeletePlayUseCase,
	GetGameUseCase,
	ListGamesUseCase,
	ListPlaysUseCase,
	SaveGameUseCase,
} from "./game.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findPlaysInRange: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		updatePlay: vi.fn().mockResolvedValue({ acknowledged: true }),
		pushPlay: vi.fn().mockResolvedValue({ acknowledged: true }),
		deletePlay: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}

const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as GameRepository;

function fakeImages() {
	return {
		isOwnUrl: (value: string) => value.startsWith("/images/game/"),
		uploadFromSource: vi.fn(
			async (gameId: string, field: string) => `personal-tracker/game/${gameId}.${field}.avif`,
		),
		resolveImages: <T>(game: T) => game,
	};
}

describe("ListGamesUseCase", () => {
	it("defaults sort to name asc and normalises a missing search to empty", () => {
		const repo = fakeRepo();
		new ListGamesUseCase(asRepo(repo), fakeImages()).execute({} as any, asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({ search: "", sortField: "name", sortDirection: "asc" });
	});

	it("passes the requested sort and search through", () => {
		const repo = fakeRepo();
		new ListGamesUseCase(asRepo(repo), fakeImages()).execute(
			{
				sort: ["playCount", "desc"],
				search: "zelda",
			} as any,
			asLog(makeLog()),
		);
		expect(repo.findAll).toHaveBeenCalledWith({
			search: "zelda",
			sortField: "playCount",
			sortDirection: "desc",
		});
	});
});

describe("ListPlaysUseCase", () => {
	it("forwards the date range", () => {
		const repo = fakeRepo();
		new ListPlaysUseCase(asRepo(repo), fakeImages()).execute(
			{ from: "2024-01-01", to: "2024-12-31" } as any,
			asLog(makeLog()),
		);
		expect(repo.findPlaysInRange).toHaveBeenCalledWith({ from: "2024-01-01", to: "2024-12-31" });
	});
});

describe("GetGameUseCase", () => {
	it("strips _id and returns plays sorted most-recent first", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({
			_id: "mongo-id",
			id: "game-1",
			name: "Celeste",
			plays: [{ date: "2024-01-01" }, { date: "2024-03-01" }],
		});

		const result = await new GetGameUseCase(asRepo(repo), fakeImages()).execute("game-1", asLog(makeLog()));

		expect(result).toEqual({
			id: "game-1",
			name: "Celeste",
			plays: [{ date: "2024-03-01" }, { date: "2024-01-01" }],
		});
	});

	it("returns null when the game is missing", async () => {
		const repo = fakeRepo();
		expect(await new GetGameUseCase(asRepo(repo), fakeImages()).execute("nope", asLog(makeLog()))).toBeNull();
	});
});

describe("SaveGameUseCase", () => {
	it("throws when both gameId and game.id are provided", async () => {
		const repo = fakeRepo();
		await expect(
			new SaveGameUseCase(asRepo(repo), fakeImages()).execute(
				{
					gameId: "g1",
					game: { id: "g1", name: "X" },
				} as any,
				asLog(makeLog()),
			),
		).rejects.toThrow("Cannot provide both gameId and game.id");
	});

	it("updates an existing game, cleaning empty links", async () => {
		const repo = fakeRepo();
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute(
			{
				game: { id: "g1", name: "Celeste", developper: "EMH", editor: "EMH", links: [] },
			} as any,
			asLog(makeLog()),
		);

		expect(repo.update).toHaveBeenCalledWith("g1", {
			id: "g1",
			name: "Celeste",
			developper: "EMH",
			editor: "EMH",
		});
	});

	it("inserts a new game with a generated id and no plays", async () => {
		const repo = fakeRepo();
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute(
			{
				game: { name: "Celeste", developper: "EMH", editor: "EMH" },
			} as any,
			asLog(makeLog()),
		);

		expect(repo.insert).toHaveBeenCalledTimes(1);
		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted).toMatchObject({ name: "Celeste", plays: [] });
		expect(inserted.id).toEqual(expect.any(String));
	});

	it("inserts a new game with an initial play", async () => {
		const repo = fakeRepo();
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute(
			{
				game: { name: "Celeste", developper: "EMH", editor: "EMH" },
				play: { date: "2024-06-01" },
			} as any,
			asLog(makeLog()),
		);

		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted.plays).toHaveLength(1);
		expect(inserted.plays[0]).toMatchObject({ date: "2024-06-01" });
		expect(inserted.plays[0].id).toEqual(expect.any(String));
	});

	it("updates an existing play when the play carries an id", async () => {
		const repo = fakeRepo();
		const play = { id: "p1", date: "2024-06-01" };
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute({ gameId: "g1", play } as any, asLog(makeLog()));
		expect(repo.updatePlay).toHaveBeenCalledWith("g1", play);
	});

	it("turns an edited auto play into a manual one, keeping its origin", async () => {
		const repo = fakeRepo();
		const play = { id: "p1", date: "2024-06-01", duration: 30, origin: "steam", auto: true };
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute({ gameId: "g1", play } as any, asLog(makeLog()));
		expect(repo.updatePlay).toHaveBeenCalledWith("g1", { ...play, auto: false });
	});

	it("keeps the origin of a new play", async () => {
		const repo = fakeRepo();
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute(
			{ gameId: "g1", play: { date: "2024-06-01", origin: "ps5" } } as any,
			asLog(makeLog()),
		);
		expect(repo.pushPlay.mock.calls[0][1]).toMatchObject({ date: "2024-06-01", origin: "ps5" });
	});

	it("pushes a freshly built play when the play has no id", async () => {
		const repo = fakeRepo();
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute(
			{
				gameId: "g1",
				play: { date: "2024-06-01" },
			} as any,
			asLog(makeLog()),
		);

		expect(repo.pushPlay).toHaveBeenCalledTimes(1);
		const [gameId, built] = repo.pushPlay.mock.calls[0];
		expect(gameId).toBe("g1");
		expect(built).toMatchObject({ date: "2024-06-01" });
		expect(built.id).toEqual(expect.any(String));
	});

	it("stores a picture given as a URL and keeps one already stored", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ id: "g1", header: "personal-tracker/game/g1.header.avif" });
		const images = fakeImages();
		await new SaveGameUseCase(asRepo(repo), images).execute(
			{
				game: {
					id: "g1",
					name: "Brotato",
					developper: "Blobfish",
					editor: "Blobfish",
					capsule: "https://shared.akamai.steamstatic.com/capsule_184x69.jpg",
					header: "/images/game/g1.header",
				},
			} as any,
			asLog(makeLog()),
		);

		expect(images.uploadFromSource).toHaveBeenCalledWith(
			"g1",
			"capsule",
			"https://shared.akamai.steamstatic.com/capsule_184x69.jpg",
		);
		expect(repo.update.mock.calls[0][1]).toMatchObject({
			capsule: "personal-tracker/game/g1.capsule.avif",
			header: "personal-tracker/game/g1.header.avif",
		});
	});

	it("drops an emptied picture, so the update removes it", async () => {
		const repo = fakeRepo();
		await new SaveGameUseCase(asRepo(repo), fakeImages()).execute(
			{ game: { id: "g1", name: "Brotato", developper: "B", editor: "B", capsule: "" } } as any,
			asLog(makeLog()),
		);
		expect(repo.update.mock.calls[0][1]).not.toHaveProperty("capsule");
	});

	it("returns a no-op result when there is nothing to do", async () => {
		const repo = fakeRepo();
		expect(await new SaveGameUseCase(asRepo(repo), fakeImages()).execute({} as any, asLog(makeLog()))).toEqual({
			error: "Nothing to do",
		});
	});
});

describe("DeletePlayUseCase", () => {
	it("deletes the play by game and play id", () => {
		const repo = fakeRepo();
		new DeletePlayUseCase(asRepo(repo)).execute({ gameId: "g1", playId: "p1" } as any, asLog(makeLog()));
		expect(repo.deletePlay).toHaveBeenCalledWith("g1", "p1");
	});

	it("throws when a required id is missing", () => {
		const repo = fakeRepo();
		expect(() => new DeletePlayUseCase(asRepo(repo)).execute({ gameId: "g1" } as any, asLog(makeLog()))).toThrow(
			"Both playId and gameId are required",
		);
	});
});
