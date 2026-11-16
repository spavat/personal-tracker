import { getDurationString } from "../../utils";

/** Playtime in the game module: hours never turn into days (49h, not 2j 1h). */
export const formatPlayDuration = (minutes: number) => getDurationString(minutes, { withDays: false });
