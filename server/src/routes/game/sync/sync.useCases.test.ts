import { CATCH_UP_DATE, type GameOrigin, type GameStore } from "@personal-tracker/shared/game";
import { beforeEach, describe, expect, it } from "vitest";

import type { GameMongo } from "../game.entity";
import type { GameRepository } from "../game.repository";
import type { StoreConnector, StoreGame } from "./connector";
import type { Snapshot, SnapshotRepository } from "./snapshot.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	ConfirmImportUseCase,
	MergeGamesUseCase,
	PreviewImportUseCase,
	ReplayUseCase,
	RunDailySyncUseCase,
} from "./sync.useCases";

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
			const existing = get(id).plays.find((p) => p.auto && p.date === play.date && p.origin === play.origin);
			if (existing) existing.duration = (existing.duration ?? 0) + play.duration;
			else get(id).plays.push(play);
		},
		replaceAutoPlay: async (id: string, play: any) => {
			const game = get(id);
			game.plays = game.plays.filter((p) => !(p.auto && p.date === play.date && p.origin === play.origin));
			game.plays.push(play);
		},
		deleteAutoPlays: async (date: string, origins: GameOrigin[]) => {
			for (const game of games) {
				game.plays = game.plays.filter((p) => !(p.auto && p.date === date && origins.includes(p.origin!)));
			}
		},
		mergeInto: async (id: string, fields: Partial<GameMongo>) => void Object.assign(get(id), fields),
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

const log = () => asLog(makeLog());
let clock: Temporal.Instant;
const now = () => clock;
const playsOf = (repo: ReturnType<typeof memoryGames>, name: string) =>
	repo.games
		.find((g) => g.name === name)!
		.plays.map(({ date, origin, duration, auto }) => ({ date, origin, duration, auto }));

let steam: ReturnType<typeof fakeConnector>;
let epic: ReturnType<typeof fakeConnector>;
beforeEach(() => {
	clock = Temporal.Instant.from("2026-11-14T04:00:00+01:00");
	steam = fakeConnector("steam", ["steam", "steam-deck"]);
	epic = fakeConnector("epic", ["epic"]);
});

describe("PreviewImportUseCase", () => {
	it("lists the catch-up of each game without writing anything", async () => {
		const games = memoryGames([manualGame("brotato", "Brotato", [{ duration: 60 }, { duration: 30 }])]);
		steam.push([steamGame("1942280", "Brotato", 4651), steamGame("1145350", "Hades II", 6755)]);

		const rows = await new PreviewImportUseCase([steam], games).execute("steam", log());

		expect(rows).toEqual([
			{
				storeGameId: "1942280",
				origin: "steam",
				name: "Brotato",
				storeMinutes: 4651,
				recordedMinutes: 90,
				catchUp: 4561,
				game: { id: "brotato", name: "Brotato" },
			},
			{
				storeGameId: "1145350",
				origin: "steam",
				name: "Hades II",
				storeMinutes: 6755,
				recordedMinutes: 0,
				catchUp: 6755,
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

		const rows = await new PreviewImportUseCase([steam], games).execute("steam", log());
		expect(rows.map((r) => [r.origin, r.catchUp])).toEqual([
			["steam", 0],
			["steam-deck", 40],
		]);
	});

	it("refuses a store that isn't configured", async () => {
		steam.isConfigured = async () => false;
		await expect(new PreviewImportUseCase([steam], memoryGames()).execute("steam", log())).rejects.toThrow(
			/pas configuré/,
		);
	});
});

describe("ConfirmImportUseCase", () => {
	it("writes the catch-ups, links or creates the games and keeps the import as baseline", async () => {
		const games = memoryGames([manualGame("brotato", "Brotato", [{ duration: 90 }])]);
		const snapshots = memorySnapshots();
		steam.push([steamGame("1942280", "Brotato", 4651), steamGame("1145350", "Hades II", 6755)]);

		const result = await new ConfirmImportUseCase([steam], games, snapshots, now).execute("steam", log());

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
		const confirm = new ConfirmImportUseCase([steam], games, snapshots, now);
		steam.push([steamGame("1145350", "Hades II", 6755)]);
		steam.push([steamGame("1145350", "Hades II", 6755)]);

		await confirm.execute("steam", log());
		await confirm.execute("steam", log());

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

		await new ConfirmImportUseCase([steam, epic], games, snapshots, now).execute("steam", log());
		await new ConfirmImportUseCase([steam, epic], games, snapshots, now).execute("epic", log());

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
		await new ConfirmImportUseCase([steam], games, snapshots, now).execute("steam", log());
		clock = clock.add({ hours: 24 });
		steam.push([steamGame("1145350", "Hades II", 130)]);
		await new RunDailySyncUseCase([steam], games, snapshots, now).execute(undefined, log());

		steam.push([steamGame("1145350", "Hades II", 130)]);
		await new ConfirmImportUseCase([steam], games, snapshots, now).execute("steam", log());

		expect(playsOf(games, "Hades II")).toEqual([
			{ date: "2026-11-14", origin: "steam", duration: 30, auto: true },
			{ date: CATCH_UP_DATE, origin: "steam", duration: 100, auto: true },
		]);
	});
});

describe("RunDailySyncUseCase", () => {
	it("only keeps a baseline on a store's first fetch", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		steam.push([steamGame("1145350", "Hades II", 6755)]);

		const results = await new RunDailySyncUseCase([steam], games, snapshots, now).execute(undefined, log());

		expect(results).toEqual([{ store: "steam", status: "baseline", plays: 0, minutes: 0 }]);
		expect(games.games).toEqual([]);
		expect(snapshots.snapshots).toMatchObject([{ kind: "run", status: "ok" }]);
	});

	it("adds the playtime since the previous fetch to the day it belongs to", async () => {
		const games = memoryGames([manualGame("hades", "Hades II")]);
		const snapshots = memorySnapshots();
		const run = new RunDailySyncUseCase([steam], games, snapshots, now);
		steam.push([steamGame("1145350", "Hades II", 6755)]);
		await run.execute(undefined, log());

		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 6800)]);
		const results = await run.execute(undefined, log());

		expect(results).toEqual([{ store: "steam", status: "ok", plays: 1, minutes: 45 }]);
		expect(playsOf(games, "Hades II")).toEqual([{ date: "2026-11-14", origin: "steam", duration: 45, auto: true }]);
		expect(snapshots.deletedBefore.at(-1)).toBe("2026-10-16T03:00:00Z");
	});

	it("adds up two runs of the same day, and an immediate rerun adds nothing", async () => {
		const games = memoryGames([manualGame("hades", "Hades II")]);
		const snapshots = memorySnapshots();
		const run = new RunDailySyncUseCase([steam], games, snapshots, now);
		steam.push([steamGame("1145350", "Hades II", 100)]);
		await run.execute(undefined, log());

		clock = Temporal.Instant.from("2026-11-14T15:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 120)]);
		await run.execute(undefined, log());
		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 150)]);
		steam.push([steamGame("1145350", "Hades II", 150)]);
		await run.execute(undefined, log());
		await run.execute(undefined, log());

		expect(playsOf(games, "Hades II")).toEqual([{ date: "2026-11-14", origin: "steam", duration: 50, auto: true }]);
	});

	it("leaves a play edited by hand alone and adds its own next to it", async () => {
		const games = memoryGames([
			manualGame("hades", "Hades II", [{ date: "2026-11-14", origin: "steam", duration: 10, auto: false }]),
		]);
		games.games[0].storeIds = { steam: "1145350" };
		const snapshots = memorySnapshots();
		const run = new RunDailySyncUseCase([steam], games, snapshots, now);
		steam.push([steamGame("1145350", "Hades II", 100)]);
		await run.execute(undefined, log());
		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 120)]);
		await run.execute(undefined, log());

		expect(playsOf(games, "Hades II")).toEqual([
			{ date: "2026-11-14", origin: "steam", duration: 10, auto: false },
			{ date: "2026-11-14", origin: "steam", duration: 20, auto: true },
		]);
	});

	it("creates a game first played since the previous fetch", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		const run = new RunDailySyncUseCase([steam], games, snapshots, now);
		steam.push([]);
		await run.execute(undefined, log());
		clock = clock.add({ hours: 24 });
		steam.push([steamGame("70", "Half-Life", 42)]);
		await run.execute(undefined, log());

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

		const results = await new RunDailySyncUseCase([steam, epic], games, snapshots, now).execute(undefined, log());

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
		const run = new RunDailySyncUseCase([steam, epic], memoryGames(), memorySnapshots(), now);
		expect((await run.execute(undefined, log())).map((r) => r.store)).toEqual(["epic"]);
		expect(await run.execute("steam", log())).toEqual([]);
	});
});

describe("ReplayUseCase", () => {
	it("rebuilds a day's plays from the snapshots, without the time before the import", async () => {
		const games = memoryGames();
		const snapshots = memorySnapshots();
		steam.push([steamGame("1145350", "Hades II", 100), steamGame("1942280", "Brotato", 10)]);
		await new ConfirmImportUseCase([steam], games, snapshots, now).execute("steam", log());
		const run = new RunDailySyncUseCase([steam], games, snapshots, now);
		clock = Temporal.Instant.from("2026-11-14T15:00:00+01:00");
		steam.push([steamGame("1145350", "Hades II", 120), steamGame("1942280", "Brotato", 10)]);
		await run.execute(undefined, log());
		clock = Temporal.Instant.from("2026-11-15T04:00:00+01:00");
		steam.push([
			steamGame("1145350", "Hades II", 150),
			steamGame("1942280", "Brotato", 25, { lastPlayed: "2026-11-14T22:00:00Z" }),
		]);
		await run.execute(undefined, log());
		const afterRuns = structuredClone(games.games);

		// a broken day: plays lost or wrong
		games.games[0].plays = games.games[0].plays.filter((p) => p.date !== "2026-11-14");
		games.games[1].plays.push({ id: "x", date: "2026-11-14", origin: "steam", duration: 999, auto: true });

		const result = await new ReplayUseCase([steam], games, snapshots).execute("steam", "2026-11-14", log());

		expect(result).toEqual({ plays: 3, minutes: 65 });
		const strip = (gs: GameMongo[]) =>
			gs.map((g) => g.plays.map(({ date, origin, duration, auto }) => ({ date, origin, duration, auto })));
		expect(strip(games.games)).toEqual(strip(afterRuns));
	});

	it("refuses to replay the catch-up day", async () => {
		await expect(
			new ReplayUseCase([steam], memoryGames(), memorySnapshots()).execute("steam", CATCH_UP_DATE, log()),
		).rejects.toThrow(/import initial/);
	});
});

describe("MergeGamesUseCase", () => {
	it("moves the plays and store ids into the kept game and deletes the duplicate", async () => {
		const games = memoryGames([
			{ ...manualGame("keep", "Brotato", [{ duration: 10 }]), storeIds: { steam: "1942280" } },
			{
				...manualGame("dup", "Brotato (Epic)", [{ duration: 20 }]),
				storeIds: { epic: "e8bbb84b" },
				capsule: "game/dup.capsule.avif",
			},
		]);

		expect(await new MergeGamesUseCase(games).execute({ keepId: "keep", removeId: "dup" }, log())).toEqual({
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
		const merge = new MergeGamesUseCase(games);
		await expect(merge.execute({ keepId: "keep", removeId: "keep" }, log())).rejects.toThrow(/lui-même/);
		expect(await merge.execute({ keepId: "keep", removeId: "nope" }, log())).toBeNull();
	});
});
