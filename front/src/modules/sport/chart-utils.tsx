// A distance range (in km) to highlight on both the pace chart and the map, e.g. on

import { Sport } from "./types";

export function formatPace(secondsPerKm: number): string {
	// rounded first, so 299.6 s gives 5:00 rather than 4:60
	const totalSeconds = Math.round(secondsPerKm);
	const mins = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;
	return `${mins}:${String(secs).padStart(2, "0")}`;
}

// One tick per km, from 0 to the last point's distance, for the pace/elevation charts' X axis.
export function buildKmTicks(data: Pick<Sport.ChartPoint, "distKm">[]): number[] {
	if (data.length === 0) return [0];
	const maxKm = Math.floor(data[data.length - 1].distKm);
	return Array.from({ length: maxKm + 1 }, (_, i) => i);
}
