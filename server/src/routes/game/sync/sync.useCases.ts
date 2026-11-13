import type { GameOrigin, GameStore } from "@personal-tracker/shared/game";
import type { FastifyBaseLogger } from "fastify";

import { randomUUID } from "crypto";

import type { GameMongo } from "../game.entity";
import type { AutoPlayMongo, GameRepository } from "../game.repository";
import type { GameImageStorageRepository } from "../image-storage.repository";
import type { StoreConnector, StoreGame } from "./connector";
import type { CredentialRepository } from "./credential.repository";
import type { Snapshot, SnapshotRepository } from "./snapshot.repository";
import type { SteamStore } from "./steam-store";

import { buildPlay } from "../game.entity";
import { GameEnricher } from "./game-enricher";
import {
	attributeDay,
	buildImportRows,
	canReplay,
	diffTotals,
	findGame,
	normalizeName,
	playDay,
	type SyncGame,
} from "./sync.entity";

type SyncGameRepository = Pick<
	GameRepository,
	| "findAllForSync"
	| "findById"
	| "insert"
	| "setStoreId"
	| "addToAutoPlay"
	| "replaceCatchUp"
	| "deleteAutoPlays"
	| "mergeInto"
	| "updateFields"
	| "deleteGame"
>;
type SyncSnapshotRepository = Pick<SnapshotRepository, "insert" | "findLatestOk" | "findOk" | "deleteOlderThan">;
type Clock = () => Temporal.Instant;

export interface SyncOptions {
	now?: Clock;
	// Steam info and pictures of the games created or linked (left out in tests: no network)
	enrichment?: {
		steam: Pick<SteamStore, "details" | "findAppId">;
		images: Pick<GameImageStorageRepository, "uploadFromSource">;
	};
}

const clockOf = (options: SyncOptions): Clock => options.now ?? (() => Temporal.Now.instant());
const enricherOf = (options: SyncOptions, log: FastifyBaseLogger) =>
	options.enrichment ? new GameEnricher(options.enrichment.steam, options.enrichment.images, log) : undefined;

const SNAPSHOT_RETENTION = { hours: 30 * 24 };
// developer / editor are required on a game
const UNKNOWN = "Inconnu";

// Two writers diffing against the same baseline would count the time twice: imports, runs and replays
// (scheduler or manual) run one at a time in the process.
let syncInProgress = false;
async function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
	if (syncInProgress) {
		throw new Error("Une synchronisation des magasins est déjà en cours");
	}
	syncInProgress = true;
	try {
		return await task();
	} finally {
		syncInProgress = false;
	}
}

/**
 * Finds the game a store game belongs to (store id, then name, then for a GOG / Epic game the Steam app of the
 * same name), creating it when there is none. Loaded once per execution. With an enricher, a new game gets its
 * Steam info and pictures, and a game linked to a store for the first time gets the pictures it lacks.
 */
class GameMatcher {
	// Steam app id of a GOG / Epic store game (exact-name search), null when Steam has none; searched once
	private steamIds = new Map<string, string | null>();
	// games created by this matcher
	created = 0;

	private constructor(
		private repo: SyncGameRepository,
		readonly games: SyncGame[],
		private enricher?: GameEnricher,
	) {}

	static async load(repo: SyncGameRepository, enricher?: GameEnricher) {
		return new GameMatcher(repo, await repo.findAllForSync(), enricher);
	}

	/** Searches the Steam ids `match` needs: the preview then shows what the import will do. */
	async prepare(store: GameStore, storeGames: StoreGame[]) {
		for (const storeGame of storeGames) {
			await this.resolveSteamId(store, storeGame);
		}
	}

	/**
	 * The game a store game belongs to (store id, then name, then for a GOG / Epic game the game owning the Steam
	 * app of the same name), and the store game's Steam app id. Needs `prepare` (or `resolveSteamId`) first.
	 */
	match(store: GameStore, storeGame: StoreGame): { game?: SyncGame; steamId?: string } {
		const game = findGame(store, storeGame, this.games);
		if (store === "steam") return { game, steamId: storeGame.storeGameId };
		const steamId = game?.storeIds?.steam ?? this.steamIds.get(storeGame.storeGameId) ?? undefined;
		return { game: game ?? (steamId ? this.gameWithSteamId(steamId) : undefined), steamId };
	}

	async findOrCreate(store: GameStore, storeGame: StoreGame): Promise<string> {
		await this.resolveSteamId(store, storeGame);
		const { game: existing, steamId } = this.match(store, storeGame);

		if (existing) {
			if (existing.storeIds?.[store] !== storeGame.storeGameId) {
				await this.link(existing, store, storeGame.storeGameId);
				// a game matched by name gets the Steam app too, unless another game has it
				if (steamId && !existing.storeIds?.steam && !this.gameWithSteamId(steamId)) {
					await this.link(existing, "steam", steamId);
				}
				const pictures = (await this.enricher?.missingPictures(existing, storeGame, steamId)) ?? {};
				if (Object.keys(pictures).length > 0) {
					await this.repo.updateFields(existing.id, pictures);
					Object.assign(existing, pictures);
				}
			}
			return existing.id;
		}

		const id = randomUUID();
		const enrichment = (await this.enricher?.forNewGame(id, storeGame, steamId)) ?? {};
		const game: GameMongo = {
			id,
			name: storeGame.name ?? storeGame.storeGameId,
			developper: UNKNOWN,
			editor: UNKNOWN,
			...enrichment,
			storeIds: { ...(steamId ? { steam: steamId } : {}), [store]: storeGame.storeGameId },
			plays: [],
		};
		await this.repo.insert(game as unknown as Record<string, unknown>);
		this.games.push(game);
		this.created++;
		return game.id;
	}

	/** A GOG / Epic store game whose match has no Steam app yet: search Steam for its exact name (once). */
	private async resolveSteamId(store: GameStore, storeGame: StoreGame) {
		if (store === "steam" || !this.enricher || this.steamIds.has(storeGame.storeGameId)) return;
		if (findGame(store, storeGame, this.games)?.storeIds?.steam) return;
		this.steamIds.set(storeGame.storeGameId, (await this.enricher.findSteamId(storeGame)) ?? null);
	}

	private gameWithSteamId(steamId: string) {
		return this.games.find((game) => game.storeIds?.steam === steamId);
	}

	private async link(game: SyncGame, store: GameStore, storeGameId: string) {
		await this.repo.setStoreId(game.id, store, storeGameId);
		game.storeIds = { ...game.storeIds, [store]: storeGameId };
	}
}

const autoPlay = (date: string, origin: GameOrigin, duration: number): AutoPlayMongo => ({
	...buildPlay({ date }),
	origin,
	duration,
	auto: true,
});

function getConnector(connectors: StoreConnector[], store: GameStore) {
	const connector = connectors.find((c) => c.store === store);
	if (!connector) throw new Error(`Magasin inconnu : ${store}`);
	return connector;
}

async function fetchConfigured(connector: StoreConnector) {
	if (!(await connector.isConfigured())) {
		throw new Error(`${connector.store} n'est pas configuré`);
	}
	return connector.fetchRaw();
}

/** What the initial import of a store would write, without writing anything. */
export class PreviewImportUseCase {
	constructor(
		private connectors: StoreConnector[],
		private games: SyncGameRepository,
		private options: SyncOptions = {},
	) {}

	async execute(store: GameStore, log: FastifyBaseLogger) {
		log.info("PreviewImportUseCase.execute");
		const connector = getConnector(this.connectors, store);
		const storeGames = connector.parse(await fetchConfigured(connector));
		// the same matching as the import, Steam search included
		const matcher = await GameMatcher.load(this.games, enricherOf(this.options, log));
		await matcher.prepare(store, storeGames);
		return buildImportRows(store, storeGames, (storeGame) => matcher.match(store, storeGame).game);
	}
}

/**
 * Initial import of a store: each played game gets (or has replaced) its catch-up play, games are matched or
 * created, and the fetch is kept as the baseline of the daily runs.
 */
export class ConfirmImportUseCase {
	constructor(
		private connectors: StoreConnector[],
		private games: SyncGameRepository,
		private snapshots: SyncSnapshotRepository,
		private options: SyncOptions = {},
	) {}

	execute(store: GameStore, log: FastifyBaseLogger) {
		return withSyncLock(() => this.importStore(store, log));
	}

	private async importStore(store: GameStore, log: FastifyBaseLogger) {
		log.info("ConfirmImportUseCase.execute");
		const connector = getConnector(this.connectors, store);
		const fetchedAt = clockOf(this.options)();
		const raw = await fetchConfigured(connector);
		const storeGames = connector.parse(raw);
		const matcher = await GameMatcher.load(this.games, enricherOf(this.options, log));
		await matcher.prepare(store, storeGames);
		const rows = buildImportRows(store, storeGames, (storeGame) => matcher.match(store, storeGame).game);

		for (const [index, row] of rows.entries()) {
			const gameId = await matcher.findOrCreate(store, storeGames[index]);
			// replaced, or removed when the store's time is now all recorded on the game
			await this.games.replaceCatchUp(
				gameId,
				row.origin,
				row.catchUp > 0 ? { ...autoPlay(row.date, row.origin, row.catchUp), catchUp: row.dateKind } : undefined,
			);
		}
		await this.snapshots.insert(snapshot(store, "import", fetchedAt, { status: "ok", raw }));

		return {
			games: new Set(rows.map((r) => r.storeGameId)).size,
			created: matcher.created,
			catchUpMinutes: rows.reduce((sum, r) => sum + r.catchUp, 0),
		};
	}
}

function snapshot(
	store: GameStore,
	kind: Snapshot["kind"],
	fetchedAt: Temporal.Instant,
	result: Pick<Snapshot, "status" | "raw" | "error">,
): Snapshot {
	return { id: randomUUID(), store, kind, fetchedAt: fetchedAt.toString(), day: playDay(fetchedAt), ...result };
}

export interface RunResult {
	store: GameStore;
	status: "ok" | "error" | "baseline";
	plays: number;
	minutes: number;
	error?: string;
}

/**
 * Daily sync: fetches each configured store, keeps the response, and adds the playtime since the previous
 * successful fetch to the auto play of the day it belongs to. The first fetch of a store is only a baseline.
 * A failing store is recorded and doesn't stop the others.
 */
export class RunDailySyncUseCase {
	constructor(
		private connectors: StoreConnector[],
		private games: SyncGameRepository,
		private snapshots: SyncSnapshotRepository,
		private options: SyncOptions = {},
	) {}

	execute(store: GameStore | undefined, log: FastifyBaseLogger): Promise<RunResult[]> {
		return withSyncLock(() => this.runStores(store, log));
	}

	private async runStores(store: GameStore | undefined, log: FastifyBaseLogger): Promise<RunResult[]> {
		log.info("RunDailySyncUseCase.execute");
		const results: RunResult[] = [];
		for (const connector of this.connectors.filter((c) => !store || c.store === store)) {
			if (!(await connector.isConfigured())) continue;
			results.push(await this.runStore(connector, log));
		}
		return results;
	}

	private async runStore(connector: StoreConnector, log: FastifyBaseLogger): Promise<RunResult> {
		const fetchedAt = clockOf(this.options)();
		const baseline = await this.snapshots.findLatestOk(connector.store);

		let raw: unknown;
		let storeGames: StoreGame[];
		try {
			raw = await connector.fetchRaw();
			storeGames = connector.parse(raw);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			log.error({ store: connector.store, error: message }, "game sync: fetch failed");
			await this.snapshots.insert(
				snapshot(connector.store, "run", fetchedAt, { status: "error", error: message }),
			);
			return { store: connector.store, status: "error", plays: 0, minutes: 0, error: message };
		}
		// kept before writing plays: a replay can redo them from it
		await this.snapshots.insert(snapshot(connector.store, "run", fetchedAt, { status: "ok", raw }));

		let result: RunResult = { store: connector.store, status: "baseline", plays: 0, minutes: 0 };
		if (baseline) {
			const { diffs, decreases } = diffTotals(connector.parse(baseline.raw), storeGames);
			if (decreases.length > 0) {
				log.warn({ store: connector.store, decreases }, "game sync: playtime decreased, ignored");
			}
			const matcher = await GameMatcher.load(this.games, enricherOf(this.options, log));
			const from = Temporal.Instant.from(baseline.fetchedAt);
			for (const diff of diffs) {
				const storeGame = storeGames.find((g) => g.storeGameId === diff.storeGameId)!;
				const gameId = await matcher.findOrCreate(connector.store, storeGame);
				const day = attributeDay(from, fetchedAt, diff.lastPlayed);
				await this.games.addToAutoPlay(gameId, autoPlay(day, diff.origin, diff.minutes));
			}
			result = {
				store: connector.store,
				status: "ok",
				plays: diffs.length,
				minutes: diffs.reduce((sum, d) => sum + d.minutes, 0),
			};
		}

		await this.snapshots.deleteOlderThan(connector.store, fetchedAt.subtract(SNAPSHOT_RETENTION).toString());
		return result;
	}
}

/**
 * Recomputes a day of a store from the kept snapshots, without calling the store: the day's auto plays of the
 * store's origins are removed, then every run's diff that belongs to that day is added back.
 */
export class ReplayUseCase {
	constructor(
		private connectors: StoreConnector[],
		private games: SyncGameRepository,
		private snapshots: SyncSnapshotRepository,
	) {}

	execute(store: GameStore, day: string, log: FastifyBaseLogger) {
		return withSyncLock(() => this.replay(store, day, log));
	}

	private async replay(store: GameStore, day: string, log: FastifyBaseLogger) {
		log.info("ReplayUseCase.execute");
		const connector = getConnector(this.connectors, store);
		const snapshots = await this.snapshots.findOk(store);
		if (!canReplay(day, snapshots[0])) {
			throw new Error("Jour trop ancien : la récupération qui l'ouvrait n'est plus gardée (30 jours)");
		}

		await this.games.deleteAutoPlays(day, connector.origins);
		const matcher = await GameMatcher.load(this.games);
		let plays = 0;
		let minutes = 0;
		for (let i = 1; i < snapshots.length; i++) {
			const [previous, current] = [snapshots[i - 1], snapshots[i]];
			// the time before an import is in the catch-up
			if (current.kind !== "run") continue;
			const from = Temporal.Instant.from(previous.fetchedAt);
			const to = Temporal.Instant.from(current.fetchedAt);
			const storeGames = connector.parse(current.raw);
			for (const diff of diffTotals(connector.parse(previous.raw), storeGames).diffs) {
				if (attributeDay(from, to, diff.lastPlayed) !== day) continue;
				const storeGame = storeGames.find((g) => g.storeGameId === diff.storeGameId)!;
				const gameId = await matcher.findOrCreate(store, storeGame);
				await this.games.addToAutoPlay(gameId, autoPlay(day, diff.origin, diff.minutes));
				plays++;
				minutes += diff.minutes;
			}
		}
		return { plays, minutes };
	}
}

/** Merges a duplicate into the kept game: plays moved, store ids and missing pictures taken, duplicate deleted. */
export class MergeGamesUseCase {
	constructor(private games: SyncGameRepository) {}

	async execute({ keepId, removeId }: { keepId: string; removeId: string }, log: FastifyBaseLogger) {
		log.info("MergeGamesUseCase.execute");
		if (keepId === removeId) {
			throw new Error("Impossible de fusionner un jeu avec lui-même");
		}
		const [keep, remove] = await Promise.all([this.games.findById(keepId), this.games.findById(removeId)]);
		if (!keep || !remove) {
			return null;
		}
		const capsule = keep.capsule ?? remove.capsule;
		const header = keep.header ?? remove.header;
		await this.games.mergeInto(keep.id, {
			plays: [...(keep.plays ?? []), ...(remove.plays ?? [])],
			storeIds: { ...remove.storeIds, ...keep.storeIds },
			...(capsule ? { capsule } : {}),
			...(header ? { header } : {}),
		});
		await this.games.deleteGame(remove.id);
		return { id: keep.id };
	}
}

export interface SyncStatusDeps {
	connectors: StoreConnector[];
	games: Pick<GameRepository, "findAllForSync">;
	snapshots: Pick<SnapshotRepository, "findRecent">;
	credentials: Pick<CredentialRepository, "getEpic">;
}

/** State of each store integration (status page), and the games that look like duplicates. */
export class GetSyncStatusUseCase {
	constructor(private deps: SyncStatusDeps) {}

	async execute(log: FastifyBaseLogger) {
		log.info("GetSyncStatusUseCase.execute");
		const { connectors, games, snapshots, credentials } = this.deps;
		const allGames = await games.findAllForSync();

		const stores = await Promise.all(
			connectors.map(async (connector) => {
				const epic = connector.store === "epic" ? await credentials.getEpic() : null;
				const recent = await snapshots.findRecent(connector.store);
				const earliestOk = recent.findLast((snapshot) => snapshot.status === "ok");
				return {
					store: connector.store,
					configured: await connector.isConfigured(),
					linkedGames: allGames.filter((game) => game.storeIds?.[connector.store]).length,
					snapshots: recent.map((snapshot) => ({
						...snapshot,
						replayable:
							snapshot.kind === "run" && snapshot.status === "ok" && canReplay(snapshot.day, earliestOk),
					})),
					...(epic ? { tokenExpiresAt: epic.refreshExpiresAt } : {}),
				};
			}),
		);

		const byName = Map.groupBy(allGames, (game) => normalizeName(game.name));
		const duplicates = [...byName.values()]
			.filter((group) => group.length > 1)
			.map((group) => group.map(({ id, name, storeIds }) => ({ id, name, ...(storeIds ? { storeIds } : {}) })));

		return {
			stores,
			duplicates,
			// the latest run, not an import (always ok) made after it
			lastRunFailed: stores.some(
				(s) => s.configured && s.snapshots.find((snapshot) => snapshot.kind === "run")?.status === "error",
			),
		};
	}
}
