import type { TrackPoint } from "@personal-tracker/shared/sport";

import { ACTIVITY_TYPES } from "./constants";

export function getActivityTypeLabel(type: string): string {
	return ACTIVITY_TYPES[type] ?? type;
}

export function formatPaceMinPerKm(pace: number): string {
	const totalSeconds = Math.round(pace * 60);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type KmSplit = {
	km: number;
	distanceKm: number;
	paceSecPerKm: number;
};

// Splits the track into 1km segments (the last one may be shorter) and computes the
// average pace of each by interpolating the elapsed time at each km boundary between
// the two points surrounding it.
export function computeKmSplits(points: TrackPoint[]): KmSplit[] {
	const usable = points.filter((p) => p.time && p.distanceFromStart != null && !p.isSuspect);
	if (usable.length < 2) return [];

	const startMs = new Date(usable[0].time!).getTime();
	const elapsedSec = (p: TrackPoint) => (new Date(p.time!).getTime() - startMs) / 1000;

	const totalDistanceKm = (usable[usable.length - 1].distanceFromStart ?? 0) / 1000;
	const maxKm = Math.floor(totalDistanceKm);

	let cursor = 0;
	const elapsedAtDistance = (targetMeters: number): number => {
		while (cursor < usable.length - 1 && (usable[cursor + 1].distanceFromStart ?? 0) < targetMeters) cursor++;
		const a = usable[cursor];
		const b = usable[cursor + 1] ?? a;
		const da = a.distanceFromStart ?? 0;
		const db = b.distanceFromStart ?? da;
		if (db === da) return elapsedSec(a);
		const ratio = (targetMeters - da) / (db - da);
		return elapsedSec(a) + ratio * (elapsedSec(b) - elapsedSec(a));
	};

	const splits: KmSplit[] = [];
	let previousElapsed = 0;

	for (let km = 1; km <= maxKm; km++) {
		const elapsed = elapsedAtDistance(km * 1000);
		splits.push({ km, distanceKm: 1, paceSecPerKm: elapsed - previousElapsed });
		previousElapsed = elapsed;
	}

	const remainderKm = totalDistanceKm - maxKm;
	if (remainderKm > 0.01) {
		const lastElapsed = elapsedSec(usable[usable.length - 1]);
		splits.push({
			km: maxKm + 1,
			distanceKm: remainderKm,
			paceSecPerKm: (lastElapsed - previousElapsed) / remainderKm,
		});
	}

	return splits;
}
