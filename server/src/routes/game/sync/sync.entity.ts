import type { GameOrigin } from "@personal-tracker/shared/game";

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
