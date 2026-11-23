import { getDurationString } from "../../utils";

/** Playtime in the game module: hours never turn into days (49h, not 2j 1h). */
export const formatPlayDuration = (minutes: number) => getDurationString(minutes, { withDays: false });

/** A stored instant (UTC) in local date and time. */
export function formatInstant(instant: string) {
	return Temporal.Instant.from(instant)
		.toZonedDateTimeISO(Temporal.Now.timeZoneId())
		.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
