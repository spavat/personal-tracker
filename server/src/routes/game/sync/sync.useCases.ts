import type { FastifyBaseLogger } from "fastify";

import { CATCH_UP_DATE, type GameOrigin, type GameStore } from "@personal-tracker/shared/game";
import { randomUUID } from "crypto";

import type { GameMongo } from "../game.entity";
import type { AutoPlayMongo, GameRepository } from "../game.repository";
import type { StoreConnector, StoreGame } from "./connector";
import type { Snapshot, SnapshotRepository } from "./snapshot.repository";

import { buildPlay } from "../game.entity";
import { attributeDay, computeCatchUp, diffTotals, normalizeName, playDay } from "./sync.entity";

type SyncGameRepository = Pick<
	GameRepository,
	| "findAllForSync"
	| "findById"
	| "insert"
	| "setStoreId"
	| "addToAutoPlay"
	| "replaceAutoPlay"
	| "deleteAutoPlays"
	| "mergeInto"
	| "deleteGame"
>;
type SyncSnapshotRepository = Pick<SnapshotRepository, "insert" | "findLatestOk" | "findOk" | "deleteOlderThan">;
type Clock = () => Temporal.Instant;

const SNAPSHOT_RETENTION = { hours: 30 * 24 };
// developer / editor are required on a game
const UNKNOWN = "Inconnu";

type SyncGame = Awaited<ReturnType<GameRepository["findAllForSync"]>>[number];

/** Finds the game a store game belongs to (store id, then name), creating it when there is none. Loaded once per run. */
class GameMatcher {
	private constructor(
		private repo: SyncGameRepository,
		private games: SyncGame[],
	) {}

	static async load(repo: SyncGameRepository) {
		return new GameMatcher(repo, await repo.findAllForSync());
	}

	find(store: GameStore, storeGame: StoreGame): SyncGame | undefined {
		const byStoreId = this.games.find((game) => game.storeIds?.[store] === storeGame.storeGameId);
		if (byStoreId || !storeGame.name) return byStoreId;
		const name = normalizeName(storeGame.name);
		// a game already linked to another id of this store is another game
		return this.games.find((game) => !game.storeIds?.[store] && normalizeName(game.name) === name);
	}

	async findOrCreate(store: GameStore, storeGame: StoreGame): Promise<string> {
		const existing = this.find(store, storeGame);
		if (existing) {
			if (existing.storeIds?.[store] !== storeGame.storeGameId) {
				await this.repo.setStoreId(existing.id, store, storeGame.storeGameId);
				existing.storeIds = { ...existing.storeIds, [store]: storeGame.storeGameId };
			}
			return existing.id;
		}

		const game: GameMongo = {
			id: randomUUID(),
			name: storeGame.name ?? storeGame.storeGameId,
			developper: storeGame.developer ?? UNKNOWN,
			editor: storeGame.publisher ?? UNKNOWN,
			storeIds: { [store]: storeGame.storeGameId },
			plays: [],
		};
		await this.repo.insert(game as unknown as Record<string, unknown>);
		this.games.push(game);
		return game.id;
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

export interface ImportRow {
	storeGameId: string;
	origin: GameOrigin;
	name: string;
	storeMinutes: number;
	// playtime already on the game: manual plays, and this origin's synced plays
	recordedMinutes: number;
	catchUp: number;
	// existing game it is matched with, none when it will be created
	game?: { id: string; name: string };
}

/**
 * Catch-up of each played store game: the store total minus what the game already records for it, i.e. the
 * synced plays of that origin and the manual plays. Manual time is used up by the game's first origins first, so
 * a game played on Steam and Steam Deck doesn't subtract it twice. Another store's catch-up is not subtracted.
 */
function buildImportRows(store: GameStore, storeGames: StoreGame[], matcher: GameMatcher): ImportRow[] {
	const manualLeft = new Map<string, number>();
	return storeGames.map((storeGame) => {
		const game = matcher.find(store, storeGame);
		const storeMinutes = Math.floor(storeGame.seconds / 60);
		const plays = game?.plays ?? [];
		const synced = plays
			.filter((p) => p.auto && p.origin === storeGame.origin && p.date !== CATCH_UP_DATE)
			.reduce((sum, p) => sum + (p.duration ?? 0), 0);
		const manual =
			(game && manualLeft.get(game.id)) ??
			plays.filter((p) => !p.auto).reduce((sum, p) => sum + (p.duration ?? 0), 0);
		const catchUp = computeCatchUp(Math.max(0, storeMinutes - synced), [{ duration: manual }]);
		if (game) {
			manualLeft.set(game.id, manual - (Math.max(0, storeMinutes - synced) - catchUp));
		}
		return {
			storeGameId: storeGame.storeGameId,
			origin: storeGame.origin,
			name: storeGame.name ?? storeGame.storeGameId,
			storeMinutes,
			recordedMinutes: storeMinutes - catchUp,
			catchUp,
			...(game ? { game: { id: game.id, name: game.name } } : {}),
		};
	});
}

/** What the initial import of a store would write, without writing anything. */
export class PreviewImportUseCase {
	constructor(
		private connectors: StoreConnector[],
		private games: SyncGameRepository,
	) {}

	async execute(store: GameStore, log: FastifyBaseLogger) {
		log.info("PreviewImportUseCase.execute");
		const connector = getConnector(this.connectors, store);
		const storeGames = connector.parse(await fetchConfigured(connector));
		return buildImportRows(store, storeGames, await GameMatcher.load(this.games));
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
		private now: Clock = () => Temporal.Now.instant(),
	) {}

	async execute(store: GameStore, log: FastifyBaseLogger) {
		log.info("ConfirmImportUseCase.execute");
		const connector = getConnector(this.connectors, store);
		const fetchedAt = this.now();
		const raw = await fetchConfigured(connector);
		const storeGames = connector.parse(raw);
		const matcher = await GameMatcher.load(this.games);
		const rows = buildImportRows(store, storeGames, matcher);

		let created = 0;
		for (const [index, row] of rows.entries()) {
			const gameId = await matcher.findOrCreate(store, storeGames[index]);
			if (!row.game) created++;
			if (row.catchUp > 0) {
				await this.games.replaceAutoPlay(gameId, autoPlay(CATCH_UP_DATE, row.origin, row.catchUp));
			}
		}
		await this.snapshots.insert(snapshot(store, "import", fetchedAt, { status: "ok", raw }));

		return {
			games: new Set(rows.map((r) => r.storeGameId)).size,
			created,
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
		private now: Clock = () => Temporal.Now.instant(),
	) {}

	async execute(store: GameStore | undefined, log: FastifyBaseLogger): Promise<RunResult[]> {
		log.info("RunDailySyncUseCase.execute");
		const results: RunResult[] = [];
		for (const connector of this.connectors.filter((c) => !store || c.store === store)) {
			if (!(await connector.isConfigured())) continue;
			results.push(await this.runStore(connector, log));
		}
		return results;
	}

	private async runStore(connector: StoreConnector, log: FastifyBaseLogger): Promise<RunResult> {
		const fetchedAt = this.now();
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
			const matcher = await GameMatcher.load(this.games);
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

	async execute(store: GameStore, day: string, log: FastifyBaseLogger) {
		log.info("ReplayUseCase.execute");
		if (day === CATCH_UP_DATE) {
			throw new Error("Le rattrapage se refait par l'import initial");
		}
		const connector = getConnector(this.connectors, store);
		const snapshots = await this.snapshots.findOk(store);

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
