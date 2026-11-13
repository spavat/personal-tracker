import { CATCH_UP_DATE, type GameCatchUp, type GameOrigin, type GameStore } from "@personal-tracker/shared/game";

import type { GameMongo } from "../game.entity";

const SYNC_TIME_ZONE = "Europe/Paris";
// a play day D runs from D 04:00 to D+1 04:00 (Europe/Paris)
const DAY_START_HOUR = 4;

/** Cumulative playtime of a game in a store, as reported by its connector. */
export interface StoreTotal {
	storeGameId: string;
	name?: string;
	origin: GameOrigin;
	seconds: number;
	// end of the last session, ISO instant
	lastPlayed?: string;
	// when the account got the game, ISO instant (Epic, which has no session date)
	acquiredAt?: string;
}

export interface PlaytimeDiff {
	storeGameId: string;
	origin: GameOrigin;
	minutes: number;
	lastPlayed?: string;
}

/** Play day the playtime elapsed until `at` belongs to: 04:00 on D+1 still closes day D. */
export function playDay(at: Temporal.Instant): string {
	return at
		.toZonedDateTimeISO(SYNC_TIME_ZONE)
		.toPlainDateTime()
		.subtract({ hours: DAY_START_HOUR, nanoseconds: 1 })
		.toPlainDate()
		.toString();
}

/**
 * Day a diff measured between two fetches is written to: the day of the game's last session when the store
 * gives one inside that window (a missed run spans several days), otherwise the day of the latest fetch.
 */
export function attributeDay(from: Temporal.Instant, to: Temporal.Instant, lastPlayed?: string): string {
	if (lastPlayed) {
		const last = Temporal.Instant.from(lastPlayed);
		if (Temporal.Instant.compare(last, from) > 0 && Temporal.Instant.compare(last, to) <= 0) {
			return playDay(last);
		}
	}
	return playDay(to);
}

const totalKey = ({ storeGameId, origin }: { storeGameId: string; origin: GameOrigin }) => `${storeGameId}|${origin}`;

/**
 * Minutes played per (game, origin) between two fetches. Minutes are diffed as floor(seconds / 60) so
 * sub-minute remainders are never lost across days. A game missing from `prev` counts from 0.
 * Decreasing totals (refund, reset) are returned apart, never as plays.
 */
export function diffTotals(prev: StoreTotal[], curr: StoreTotal[]) {
	const previous = new Map(prev.map((total) => [totalKey(total), total.seconds]));
	const diffs: PlaytimeDiff[] = [];
	const decreases: PlaytimeDiff[] = [];

	for (const total of curr) {
		const minutes = Math.floor(total.seconds / 60) - Math.floor((previous.get(totalKey(total)) ?? 0) / 60);
		const diff = {
			storeGameId: total.storeGameId,
			origin: total.origin,
			minutes,
			...(total.lastPlayed ? { lastPlayed: total.lastPlayed } : {}),
		};
		if (minutes > 0) {
			diffs.push(diff);
		} else if (minutes < 0) {
			decreases.push(diff);
		}
	}
	return { diffs, decreases };
}

/** Name used to match a store game with an existing game: case, accents, punctuation and ™ ® © ignored. */
export function normalizeName(name: string): string {
	return name
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

/** Catch-up minutes: the store total minus the playtime already recorded on the game, never negative. */
export function computeCatchUp(totalMinutes: number, existingPlays: Array<{ duration?: number }>): number {
	const recorded = existingPlays.reduce((sum, play) => sum + (play.duration ?? 0), 0);
	return Math.max(0, totalMinutes - recorded);
}

/** The latest daily run slot (04:00 Europe/Paris) at or before `now`. */
export function lastRunSlot(now: Temporal.Instant): Temporal.Instant {
	const zoned = now.toZonedDateTimeISO(SYNC_TIME_ZONE);
	const today = zoned.toPlainDate().toZonedDateTime({
		timeZone: SYNC_TIME_ZONE,
		plainTime: Temporal.PlainTime.from({ hour: DAY_START_HOUR }),
	});
	return (Temporal.ZonedDateTime.compare(today, zoned) <= 0 ? today : today.subtract({ days: 1 })).toInstant();
}

/** The next daily run slot strictly after `now`. */
export function nextRunSlot(now: Temporal.Instant): Temporal.Instant {
	return lastRunSlot(now).toZonedDateTimeISO(SYNC_TIME_ZONE).add({ days: 1 }).toInstant();
}

/** True when no fetch happened since the latest slot (server down at 04:00): the run is due now. */
export function isRunDue(now: Temporal.Instant, lastFetchedAt?: string): boolean {
	return !lastFetchedAt || Temporal.Instant.compare(Temporal.Instant.from(lastFetchedAt), lastRunSlot(now)) < 0;
}

/** A game as the sync sees it: what matching, catch-up and missing pictures need. */
export type SyncGame = Pick<GameMongo, "id" | "name" | "storeIds" | "plays" | "capsule" | "header">;

/** The game a store game belongs to: same store id, else same name unless that game has another id in this store. */
export function findGame(store: GameStore, storeGame: StoreTotal, games: SyncGame[]): SyncGame | undefined {
	const byStoreId = games.find((game) => game.storeIds?.[store] === storeGame.storeGameId);
	if (byStoreId || !storeGame.name) return byStoreId;
	const name = normalizeName(storeGame.name);
	return games.find((game) => !game.storeIds?.[store] && normalizeName(game.name) === name);
}

export interface ImportRow {
	storeGameId: string;
	origin: GameOrigin;
	name: string;
	storeMinutes: number;
	// playtime already on the game: manual plays, and this origin's synced plays
	recordedMinutes: number;
	catchUp: number;
	// date the catch-up play gets, and where it comes from
	date: string;
	dateKind: GameCatchUp;
	// existing game it is matched with, none when it will be created
	game?: { id: string; name: string };
}

/**
 * Date of a store game's catch-up play: the day of its last session, else of its acquisition (Epic), else
 * CATCH_UP_DATE. It dates the game (sort, last play); the catch-up stays out of the period views.
 */
export function catchUpDate(storeGame: Pick<StoreTotal, "lastPlayed" | "acquiredAt">): {
	date: string;
	dateKind: GameCatchUp;
} {
	if (storeGame.lastPlayed) {
		return { date: playDay(Temporal.Instant.from(storeGame.lastPlayed)), dateKind: "last-session" };
	}
	if (storeGame.acquiredAt) {
		return { date: playDay(Temporal.Instant.from(storeGame.acquiredAt)), dateKind: "acquired" };
	}
	return { date: CATCH_UP_DATE, dateKind: "unknown" };
}

/**
 * Catch-up of each played store game: the store total minus what the game already records for it, i.e. the
 * synced plays of that origin and the manual plays. Manual time is used up by the game's first origins first, so
 * a game played on Steam and Steam Deck doesn't subtract it twice. Another store's catch-up is not subtracted.
 */
export function buildImportRows(store: GameStore, storeGames: StoreTotal[], games: SyncGame[]): ImportRow[] {
	const manualLeft = new Map<string, number>();
	return storeGames.map((storeGame) => {
		const game = findGame(store, storeGame, games);
		const storeMinutes = Math.floor(storeGame.seconds / 60);
		const plays = game?.plays ?? [];
		const synced = plays
			.filter((p) => p.auto && p.origin === storeGame.origin && !p.catchUp)
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
			...catchUpDate(storeGame),
			...(game ? { game: { id: game.id, name: game.name } } : {}),
		};
	});
}
