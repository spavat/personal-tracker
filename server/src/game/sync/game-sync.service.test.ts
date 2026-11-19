import { CATCH_UP_DATE, type GameOrigin, type GameStore } from "@personal-tracker/shared/game";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameImagesStorage } from "../game-images.storage.js";
import type { GameMongo } from "../game.entity.js";
import type { GameRepository } from "../game.repository.js";
import type { StoreConnector, StoreGame } from "./connector.js";
import type { CredentialRepository } from "./credential.repository.js";
import type { Snapshot, SnapshotRepository } from "./snapshot.repository.js";
import type { SteamStore } from "./steam-store.client.js";

import { GameSyncService } from "./game-sync.service.js";
import { GameEnricher } from "./game.enricher.js";

// --- in-memory repositories, so a run and its replay can be compared on the resulting plays ---

function memoryGames(initial: GameMongo[] = []) {
	const games: GameMongo[] = structuredClone(initial);
	const get = (id: string) => games.find((g) => g.id === id)!;
	const repo = {
		games,
		findAllForSync: async () => structuredClone(games),
		findById: async (id: string) => structuredClone(games.find((g) => g.id === id) ?? null),
		insert: async (game: Record<string, unknown>) => void games.push(structuredClone(game) as unknown as GameMongo),
		setStoreId: async (id: string, store: GameStore, storeGameId: string) => {
			get(id).storeIds = { ...get(id).storeIds, [store]: storeGameId };
		},
		addToAutoPlay: async (id: string, play: any) => {
			const existing = get(id).plays.find(
				(p) => p.auto && !p.catchUp && p.date === play.date && p.origin === play.origin,
			);
			if (existing) existing.duration = (existing.duration ?? 0) + play.duration;
			else get(id).plays.push(play);
		},
		replaceCatchUp: async (id: string, origin: GameOrigin, play?: any) => {
			const game = get(id);
			game.plays = game.plays.filter((p) => !(p.auto && p.catchUp && p.origin === origin));
			if (play) game.plays.push(play);
		},
		deleteAutoPlays: async (date: string, origins: GameOrigin[]) => {
			for (const game of games) {
				game.plays = game.plays.filter(
					(p) => !(p.auto && !p.catchUp && p.date === date && origins.includes(p.origin!)),
				);
			}
		},
		mergeInto: async (id: string, fields: Partial<GameMongo>) => void Object.assign(get(id), fields),
		updateFields: async (id: string, fields: Partial<GameMongo>) => void Object.assign(get(id), fields),
		deleteGame: async (id: string) => void games.splice(games.indexOf(get(id)), 1),
	};
	return repo as typeof repo & GameRepository;
}

function memorySnapshots() {
	const snapshots: Snapshot[] = [];
	const ok = (store: GameStore) =>
		snapshots
			.filter((s) => s.store === store && s.status === "ok")
			.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
	const repo = {
		snapshots,
		deletedBefore: [] as string[],
		insert: async (snapshot: Snapshot) => void snapshots.push(structuredClone(snapshot)),
		findLatestOk: async (store: GameStore) => ok(store).at(-1) ?? null,
		findOk: async (store: GameStore) => ok(store),
		deleteOlderThan: async (_store: GameStore, before: string) => void repo.deletedBefore.push(before),
	};
	return repo as typeof repo & SnapshotRepository;
}

/** Connector whose raw response is the list of store games itself; each fetch returns the next queued one. */
function fakeConnector(store: GameStore, origins: GameOrigin[]) {
	const queue: Array<StoreGame[] | Error> = [];
	const connector = {
		store,
		origins,
		push: (response: StoreGame[] | Error) => queue.push(response),
		isConfigured: async () => true,
		fetchRaw: async () => {
			const response = queue.shift();
			if (!response) throw new Error("nothing queued");
			if (response instanceof Error) throw response;
			return structuredClone(response);
		},
		parse: (raw: unknown) => raw as StoreGame[],
	};
	return connector as typeof connector & StoreConnector;
}

const steamGame = (storeGameId: string, name: string, minutes: number, extra: Partial<StoreGame> = {}): StoreGame => ({
	storeGameId,
	name,
	origin: "steam",
	seconds: minutes * 60,
	...extra,
});

const manualGame = (id: string, name: string, plays: Array<Partial<GameMongo["plays"][number]>> = []): GameMongo => ({
	id,
	name,
	developper: "Blobfish",
	editor: "Blobfish",
	plays: plays.map((p, i) => ({ id: `${id}-p${i}`, date: "2026-01-01", ...p })),
});

// no Steam search nor picture upload (no network): the game keeps the store's name and "Inconnu"
const noEnrichment = {
	findSteamId: async () => undefined,
	forNewGame: async () => ({}),
	missingPictures: async () => ({}),
} as unknown as GameEnricher;
const enricherOf = ({ steam, images }: { steam: unknown; images: unknown }) =>
	new GameEnricher(steam as SteamStore, images as GameImagesStorage);

function sync(
	connectors: StoreConnector[],
	games = memoryGames(),
	snapshots = memorySnapshots(),
	enricher = noEnrichment,
) {
	return new GameSyncService(connectors, games, snapshots, {} as CredentialRepository, enricher);
}

let clock: Temporal.Instant;
const playsOf = (repo: ReturnType<typeof memoryGames>, name: string) =>
	repo.games
		.find((g) => g.name === name)!
		.plays.map(({ date, origin, duration, auto }) => ({ date, origin, duration, auto }));

let steam: ReturnType<typeof fakeConnector>;
let epic: ReturnType<typeof fakeConnector>;
beforeEach(() => {
	clock = Temporal.Instant.from("2026-11-14T04:00:00+01:00");
	vi.spyOn(Temporal.Now, "instant").mockImplementation(() => clock);
	steam = fakeConnector("steam", ["steam", "steam-deck"]);
	epic = fakeConnector("epic", ["epic"]);
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe("GameSyncService.preview", () => {
	it("lists the catch-up of each game without writing anything", async () => {
		const games = memoryGames([manualGame("brotato", "Brotato", [{ duration: 60 }, { duration: 30 }])]);
		steam.push([steamGame("1942280", "Brotato", 4651), steamGame("1145350", "Hades II", 6755)]);

		const rows = await sync([steam], games).preview("steam");

		expect(rows).toEqual([
			{
				storeGameId: "1942280",
				origin: "steam",
				name: "Brotato",
				storeMinutes: 4651,
				recordedMinutes: 90,
				catchUp: 4561,
				date: CATCH_UP_DATE,
				dateKind: "unknown",
				game: { id: "brotato", name: "Brotato" },
			},
			{
				storeGameId: "1145350",
				origin: "steam",
				name: "Hades II",
				storeMinutes: 6755,
				recordedMinutes: 0,
				catchUp: 6755,
				date: CATCH_UP_DATE,
				dateKind: "unknown",
			},
		]);
		expect(games.games).toHaveLength(1);
		expect(games.games[0].plays).toHaveLength(2);
	});

	it("uses the manual time once for a game played on Steam and Steam Deck", async () => {
		const games = memoryGames([manualGame("brotato", "Brotato", [{ duration: 100 }])]);
		steam.push([
			steamGame("1942280", "Brotato", 60),
			steamGame("1942280", "Brotato", 80, { origin: "steam-deck" }),
		]);

		const rows = await sync([steam], games).preview("steam");
		expect(rows.map((r) => [r.origin, r.catchUp])).toEqual([
			["steam", 0],
			["steam-deck", 40],
		]);
	});

	it("refuses a store that isn't configured", async () => {
		steam.isConfigured = async () => false;
		await expect(sync([steam]).preview("steam")).rejects.toMatchObject({ code: "upstream_unavailable" });
	});
});

describe("GameSyncService.import", () => {
	it("writes the catch-ups, links or creates the games and keeps the import as baseline", async () => {
		const games = memoryGames([manualGame("brotato", "Brotato", [{ duration: 90 }])]);
		const snapshots = memorySnapshots();
		steam.push([steamGame("1942280", "Brotato", 4651), steamGame("1145350", "Hades II", 6755)]);

		const result = await sync([steam], games, snapshots).import("steam");

		expect(result).toEqual({ games: 2, created: 1, catchUpMinutes: 4561 + 6755 });
		expect(games.games[0].storeIds).toEqual({ steam: "1942280" });
		expect(playsOf(games, "Brotato")).toContainEqual({
			date: CATCH_UP_DATE,
			origin: "steam",
			duration: 4561,
			auto: true,
		});
		expect(games.games[1]).toMatchObject({
			name: "Hades II",
			developper: "Inconnu",
			editor: "Inconnu",
			storeIds: { steam: "1145350" },
		});
		expect(playsOf(games, "Hades II")).toEqual([
			{ date: CATCH_UP_DATE, origin: "steam", duration: 6755, auto: true },
		]);
		expect(snapshots.snapshots).toMatchObject([
			{ store: "steam", kind: "import", status: "ok", day: "2026-11-13" },
		]);
	});

	it("is idempotent: importing again replaces the catch-up", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		const service = sync([steam], games, snapshots);
		steam.push([steamGame("1145350", "Hades II", 6755)]);
		steam.push([steamGame("1145350", "Hades II", 6755)]);

		await service.import("steam");
		await service.import("steam");

		expect(games.games).toHaveLength(1);
		expect(playsOf(games, "Hades II")).toEqual([
			{ date: CATCH_UP_DATE, origin: "steam", duration: 6755, auto: true },
		]);
	});

	it("doesn't subtract another store's catch-up", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		steam.push([steamGame("1942280", "Brotato", 4651)]);
		epic.push([{ storeGameId: "e8bbb84b", name: "Brotato", origin: "epic", seconds: 3492 * 60 }]);

		await sync([steam, epic], games, snapshots).import("steam");
		await sync([steam, epic], games, snapshots).import("epic");

		expect(games.games).toHaveLength(1);
		expect(games.games[0].storeIds).toEqual({ steam: "1942280", epic: "e8bbb84b" });
		expect(playsOf(games, "Brotato").map((p) => [p.origin, p.duration])).toEqual([
			["steam", 4651],
			["epic", 3492],
		]);
	});

	it("doesn't count twice the time synced since a previous import", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		steam.push([steamGame("1145350", "Hades II", 100)]);
		await sync([steam], games, snapshots).import("steam");
		clock = clock.add({ hours: 24 });
		steam.push([steamGame("1145350", "Hades II", 130)]);
		await sync([steam], games, snapshots).run();

		steam.push([steamGame("1145350", "Hades II", 130)]);
		await sync([steam], games, snapshots).import("steam");

		expect(playsOf(games, "Hades II")).toEqual([
			{ date: "2026-11-14", origin: "steam", duration: 30, auto: true },
			{ date: CATCH_UP_DATE, origin: "steam", duration: 100, auto: true },
		]);
	});
});

describe("GameSyncService.run", () => {
	it("only keeps a baseline on a store's first fetch", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		steam.push([steamGame("1145350", "Hades II", 6755)]);

		const results = await sync([steam], games, snapshots).run();

		expect(results).toEqual([{ store: "steam", status: "baseline", plays: 0, minutes: 0 }]);
		expect(games.games).toEqual([]);
		expect(snapshots.snapshots).toMatchObject([{ kind: "run", status: "ok" }]);
	});

	it("adds the playtime since the previous fetch to the day it belongs to", async () => {
		const games = memoryGames([manualGame("hades", "Hades II")]);
		const snapshots = memorySnapshots();
		const service = sync([steam], games, snapshots);
		steam.push([steamGame("1145350", "Hades II", 6755)]);
		await service.run();

		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 6800)]);
		const results = await service.run();

		expect(results).toEqual([{ store: "steam", status: "ok", plays: 1, minutes: 45 }]);
		expect(playsOf(games, "Hades II")).toEqual([{ date: "2026-11-14", origin: "steam", duration: 45, auto: true }]);
		expect(snapshots.deletedBefore.at(-1)).toBe("2026-10-16T03:00:00Z");
	});

	it("adds up two runs of the same day, and an immediate rerun adds nothing", async () => {
		const games = memoryGames([manualGame("hades", "Hades II")]);
		const snapshots = memorySnapshots();
		const service = sync([steam], games, snapshots);
		steam.push([steamGame("1145350", "Hades II", 100)]);
		await service.run();

		clock = Temporal.Instant.from("2026-11-14T15:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 120)]);
		await service.run();
		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 150)]);
		steam.push([steamGame("1145350", "Hades II", 150)]);
		await service.run();
		await service.run();

		expect(playsOf(games, "Hades II")).toEqual([{ date: "2026-11-14", origin: "steam", duration: 50, auto: true }]);
	});

	it("leaves a play edited by hand alone and adds its own next to it", async () => {
		const games = memoryGames([
			manualGame("hades", "Hades II", [{ date: "2026-11-14", origin: "steam", duration: 10, auto: false }]),
		]);
		games.games[0].storeIds = { steam: "1145350" };
		const snapshots = memorySnapshots();
		const service = sync([steam], games, snapshots);
		steam.push([steamGame("1145350", "Hades II", 100)]);
		await service.run();
		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 120)]);
		await service.run();

		expect(playsOf(games, "Hades II")).toEqual([
			{ date: "2026-11-14", origin: "steam", duration: 10, auto: false },
			{ date: "2026-11-14", origin: "steam", duration: 20, auto: true },
		]);
	});

	it("creates a game first played since the previous fetch", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		const service = sync([steam], games, snapshots);
		steam.push([]);
		await service.run();
		clock = clock.add({ hours: 24 });
		steam.push([steamGame("70", "Half-Life", 42)]);
		await service.run();

		expect(games.games).toMatchObject([{ name: "Half-Life", storeIds: { steam: "70" } }]);
		expect(playsOf(games, "Half-Life")).toEqual([
			{ date: "2026-11-14", origin: "steam", duration: 42, auto: true },
		]);
	});

	it("records a failing store and still runs the others", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		steam.push(new Error("Steam : erreur 503"));
		epic.push([]);

		const results = await sync([steam, epic], games, snapshots).run();

		expect(results).toEqual([
			{ store: "steam", status: "error", plays: 0, minutes: 0, error: "Steam : erreur 503" },
			{ store: "epic", status: "baseline", plays: 0, minutes: 0 },
		]);
		expect(snapshots.snapshots).toMatchObject([
			{ store: "steam", status: "error", error: "Steam : erreur 503" },
			{ store: "epic", status: "ok" },
		]);
	});

	it("skips the stores that aren't configured, and runs only the store asked", async () => {
		steam.isConfigured = async () => false;
		epic.push([]);
		const service = sync([steam, epic], memoryGames(), memorySnapshots());
		expect((await service.run()).map((r) => r.store)).toEqual(["epic"]);
		expect(await service.run("steam")).toEqual([]);
	});
});

describe("GameSyncService.replay", () => {
	it("rebuilds a day's plays from the snapshots, without the time before the import", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		steam.push([steamGame("1145350", "Hades II", 100), steamGame("1942280", "Brotato", 10)]);
		await sync([steam], games, snapshots).import("steam");
		const service = sync([steam], games, snapshots);
		clock = Temporal.Instant.from("2026-11-14T15:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 120), steamGame("1942280", "Brotato", 10)]);
		await service.run();
		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([
			steamGame("1145350", "Hades II", 150),
			steamGame("1942280", "Brotato", 25, { lastPlayed: "2026-11-14T22:00:00Z" }),
		]);
		await service.run();
		const afterRuns = structuredClone(games.games);

		// a broken day: plays lost or wrong
		games.games[0].plays = games.games[0].plays.filter((p) => p.date !== "2026-11-14");
		games.games[1].plays.push({ id: "x", date: "2026-11-14", origin: "steam", duration: 999, auto: true });

		const result = await sync([steam], games, snapshots).replay("steam", "2026-11-14");

		expect(result).toEqual({ plays: 3, minutes: 65 });
		const strip = (gs: GameMongo[]) =>
			gs.map((g) => g.plays.map(({ date, origin, duration, auto }) => ({ date, origin, duration, auto })));
		expect(strip(games.games)).toEqual(strip(afterRuns));
	});
});

describe("GameSyncService.replay on the oldest kept day", () => {
	it("refuses a day whose opening snapshot was deleted, and keeps its plays", async () => {
		const games = memoryGames([
			{
				...manualGame("hades", "Hades II", [{ date: "2026-10-15", origin: "steam", duration: 50, auto: true }]),
				storeIds: { steam: "1145350" },
			},
		]);
		const snapshots = memorySnapshots();
		// retention left the 15th's 15:00 run as the earliest one: the 15th's 04:00 snapshot is gone
		snapshots.snapshots.push(
			{
				id: "a",
				store: "steam",
				kind: "run",
				fetchedAt: "2026-10-15T13:00:00Z",
				day: "2026-10-15",
				status: "ok",
				raw: [steamGame("1145350", "Hades II", 100)],
			},
			{
				id: "b",
				store: "steam",
				kind: "run",
				fetchedAt: "2026-10-16T02:00:00Z",
				day: "2026-10-15",
				status: "ok",
				raw: [steamGame("1145350", "Hades II", 120)],
			},
		);

		await expect(sync([steam], games, snapshots).replay("steam", "2026-10-15")).rejects.toMatchObject({
			code: "game.replay_too_old",
		});
		expect(playsOf(games, "Hades II")).toEqual([{ date: "2026-10-15", origin: "steam", duration: 50, auto: true }]);
	});
});

describe("GameSyncService.merge", () => {
	it("moves the plays and store ids into the kept game and deletes the duplicate", async () => {
		const games = memoryGames([
			{ ...manualGame("keep", "Brotato", [{ duration: 10 }]), storeIds: { steam: "1942280" } },
			{
				...manualGame("dup", "Brotato (Epic)", [{ duration: 20 }]),
				storeIds: { epic: "e8bbb84b" },
				capsule: "game/dup.capsule.avif",
			},
		]);

		expect(await sync([], games).merge({ keepId: "keep", removeId: "dup" })).toEqual({
			id: "keep",
		});

		expect(games.games).toHaveLength(1);
		expect(games.games[0]).toMatchObject({
			id: "keep",
			storeIds: { steam: "1942280", epic: "e8bbb84b" },
			capsule: "game/dup.capsule.avif",
		});
		expect(games.games[0].plays.map((p) => p.duration)).toEqual([10, 20]);
	});

	it("refuses to merge a game with itself, and returns null for an unknown game", async () => {
		const games = memoryGames([manualGame("keep", "Brotato")]);
		const service = sync([], games);
		await expect(service.merge({ keepId: "keep", removeId: "keep" })).rejects.toMatchObject({
			code: "game.merge_self",
		});
		await expect(service.merge({ keepId: "keep", removeId: "nope" })).rejects.toMatchObject({ code: "not_found" });
	});
});

describe("store sync with Steam enrichment", () => {
	const enrichment = (details: Record<string, any> = {}, appIds: Record<string, string> = {}) => {
		const uploads: Array<[string, string, string]> = [];
		return {
			uploads,
			steam: {
				details: async (appId: string) => {
					if (details[appId] instanceof Error) throw details[appId];
					return details[appId] ?? null;
				},
				findAppId: async (name: string) => appIds[name],
			},
			images: {
				uploadFromSource: async (gameId: string, field: string, source: string) => {
					uploads.push([gameId, field, source]);
					return `personal-tracker/game/${gameId}.${field}.avif`;
				},
			},
		};
	};

	it("gives a new Steam game its developer, publisher and pictures", async () => {
		const games = memoryGames();
		const deps = enrichment({
			"1942280": {
				developer: "Blobfish",
				publisher: "Blobfish",
				capsule: "https://steam/capsule.jpg",
				header: "https://steam/header.jpg",
			},
		});
		steam.push([steamGame("1942280", "Brotato", 4651)]);

		await sync([steam], games, memorySnapshots(), enricherOf(deps)).import("steam");

		const [game] = games.games;
		expect(game).toMatchObject({
			developper: "Blobfish",
			editor: "Blobfish",
			capsule: `personal-tracker/game/${game.id}.capsule.avif`,
			header: `personal-tracker/game/${game.id}.header.avif`,
		});
		expect(deps.uploads.map(([, field, source]) => [field, source])).toEqual([
			["capsule", "https://steam/capsule.jpg"],
			["header", "https://steam/header.jpg"],
		]);
	});

	it("links an Epic game to the game owning the Steam app of the same name, filling its missing pictures", async () => {
		const games = memoryGames([
			{ ...manualGame("hades", "Hades™ Supergiant Edition"), storeIds: { steam: "1145360" } },
		]);
		const deps = enrichment({ "1145360": { capsule: "https://steam/hades-capsule.jpg" } }, { Hades: "1145360" });
		epic.push([{ storeGameId: "Min", name: "Hades", origin: "epic", seconds: 6392 * 60 }]);

		await sync([epic], games, memorySnapshots(), enricherOf(deps)).import("epic");

		expect(games.games).toHaveLength(1);
		expect(games.games[0]).toMatchObject({
			storeIds: { steam: "1145360", epic: "Min" },
			capsule: "personal-tracker/game/hades.capsule.avif",
		});
	});

	it("creates a GOG game with the Steam info of its exact name, and falls back on the store's image", async () => {
		const games = memoryGames();
		const deps = enrichment(
			{ "292030": { developer: "CD PROJEKT RED", publisher: "CD PROJEKT RED" } },
			{ "The Witcher 3": "292030" },
		);
		const gog = fakeConnector("gog", ["gog"]);
		gog.push([
			{
				storeGameId: "1495134320",
				name: "The Witcher 3",
				origin: "gog",
				seconds: 60,
				image: "https://gog/w3.jpg",
			},
		]);

		await sync([gog], games, memorySnapshots(), enricherOf(deps)).import("gog");

		expect(games.games[0]).toMatchObject({
			developper: "CD PROJEKT RED",
			storeIds: { steam: "292030", gog: "1495134320" },
		});
		expect(deps.uploads.map(([, field, source]) => [field, source])).toEqual([
			["capsule", "https://gog/w3.jpg"],
			["header", "https://gog/w3.jpg"],
		]);
	});

	it("still creates the game when Steam fails", async () => {
		const games = memoryGames();
		const deps = enrichment({ "70": new Error("Steam store : erreur 429") });
		steam.push([steamGame("70", "Half-Life", 42)]);

		await sync([steam], games, memorySnapshots(), enricherOf(deps)).import("steam");

		expect(games.games[0]).toMatchObject({ name: "Half-Life", developper: "Inconnu", editor: "Inconnu" });
		expect(games.games[0].capsule).toBeUndefined();
	});
});

describe("dated catch-ups", () => {
	const catchUpsOf = (repo: ReturnType<typeof memoryGames>, name: string) =>
		repo.games
			.find((g) => g.name === name)!
			.plays.filter((p) => p.catchUp)
			.map(({ date, origin, duration, catchUp }) => ({ date, origin, duration, catchUp }));

	it("dates the catch-up by the game's last session", async () => {
		const games = memoryGames();
		steam.push([steamGame("1942280", "Brotato", 4651, { lastPlayed: "2026-07-14T20:09:57Z" })]);

		await sync([steam], games, memorySnapshots()).import("steam");

		expect(catchUpsOf(games, "Brotato")).toEqual([
			{ date: "2026-07-14", origin: "steam", duration: 4651, catchUp: "last-session" },
		]);
	});

	it("keeps a catch-up edited by hand and counts it as recorded time", async () => {
		const games = memoryGames();
		const service = sync([steam], games, memorySnapshots());
		steam.push([steamGame("1145350", "Hades II", 100)]);
		await service.import("steam");
		// edited in the form: 80 min, now a manual play
		Object.assign(games.games[0].plays[0], { duration: 80, auto: false });

		steam.push([steamGame("1145350", "Hades II", 100)]);
		await service.import("steam");

		expect(catchUpsOf(games, "Hades II")).toEqual([
			{ date: CATCH_UP_DATE, origin: "steam", duration: 80, catchUp: "unknown" },
			{ date: CATCH_UP_DATE, origin: "steam", duration: 20, catchUp: "unknown" },
		]);
	});

	it("removes a catch-up that manual plays now cover, on a new import", async () => {
		const games = memoryGames();
		const service = sync([steam], games, memorySnapshots());
		steam.push([steamGame("1145350", "Hades II", 100)]);
		await service.import("steam");
		games.games[0].plays.push({ id: "m", date: "2026-01-01", duration: 120 });

		steam.push([steamGame("1145350", "Hades II", 100)]);
		await service.import("steam");

		expect(catchUpsOf(games, "Hades II")).toEqual([]);
	});

	it("never adds a run's time to a catch-up of the same day, nor replays it away", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		// imported at 10:00 after a session at 09:00: the catch-up is dated 2026-11-14, like the 15:00 run's time
		clock = Temporal.Instant.from("2026-11-14T10:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 100, { lastPlayed: "2026-11-14T08:00:00Z" })]);
		await sync([steam], games, snapshots).import("steam");
		clock = Temporal.Instant.from("2026-11-14T15:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 130)]);
		await sync([steam], games, snapshots).run();

		const expected = [
			{ date: "2026-11-14", origin: "steam", duration: 100, auto: true },
			{ date: "2026-11-14", origin: "steam", duration: 30, auto: true },
		];
		expect(playsOf(games, "Hades II")).toEqual(expected);

		await sync([steam], games, snapshots).replay("steam", "2026-11-14");
		expect(playsOf(games, "Hades II")).toEqual(expected);
		expect(catchUpsOf(games, "Hades II")).toEqual([
			{ date: "2026-11-14", origin: "steam", duration: 100, catchUp: "last-session" },
		]);
	});
});

describe("import preview matches like the import", () => {
	const enrichment = (details: Record<string, any>, appIds: Record<string, string>) => ({
		steam: {
			details: async (appId: string) => details[appId] ?? null,
			findAppId: async (name: string) => appIds[name],
		},
		images: {
			uploadFromSource: async (gameId: string, field: string) => `personal-tracker/game/${gameId}.${field}.avif`,
		},
	});

	it("shows a GOG / Epic game linked through its Steam app, with that game's manual plays subtracted", async () => {
		const games = memoryGames([
			{ ...manualGame("hades", "Hades™ Supergiant Edition", [{ duration: 60 }]), storeIds: { steam: "1145360" } },
		]);
		epic.push([{ storeGameId: "Min", name: "Hades", origin: "epic", seconds: 100 * 60 }]);

		const [row] = await sync(
			[epic],
			games,
			memorySnapshots(),
			enricherOf(enrichment({}, { Hades: "1145360" })),
		).preview("epic");

		expect(row).toMatchObject({ game: { id: "hades" }, recordedMinutes: 60, catchUp: 40 });
	});

	it("counts a new game once, even with a Steam and a Steam Deck total", async () => {
		steam.push([
			steamGame("1942280", "Brotato", 60),
			steamGame("1942280", "Brotato", 30, { origin: "steam-deck" }),
		]);
		const result = await sync([steam], memoryGames(), memorySnapshots()).import("steam");
		expect(result.created).toBe(1);
	});

	it("gives a game matched by name its Steam app and the Steam pictures", async () => {
		const games = memoryGames([manualGame("w3", "Hollow Knight")]);
		const deps = enrichment(
			{ "367520": { capsule: "https://steam/hk-capsule.jpg" } },
			{ "Hollow Knight": "367520" },
		);
		const gog = fakeConnector("gog", ["gog"]);
		gog.push([
			{
				storeGameId: "1308320804",
				name: "Hollow Knight",
				origin: "gog",
				seconds: 60,
				image: "https://gog/hk.jpg",
			},
		]);

		await sync([gog], games, memorySnapshots(), enricherOf(deps)).import("gog");

		expect(games.games[0]).toMatchObject({
			storeIds: { gog: "1308320804", steam: "367520" },
			capsule: "personal-tracker/game/w3.capsule.avif",
		});
	});

	it("doesn't give a name-matched game a Steam app another game already has", async () => {
		const games = memoryGames([
			{ ...manualGame("owner", "Hollow Knight (Steam)"), storeIds: { steam: "367520" } },
			manualGame("w3", "Hollow Knight"),
		]);
		const gog = fakeConnector("gog", ["gog"]);
		gog.push([{ storeGameId: "1308320804", name: "Hollow Knight", origin: "gog", seconds: 60 }]);

		await sync([gog], games, memorySnapshots(), enricherOf(enrichment({}, { "Hollow Knight": "367520" }))).import(
			"gog",
		);

		expect(games.games.find((g) => g.id === "w3")!.storeIds).toEqual({ gog: "1308320804" });
	});
});
