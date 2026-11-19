import type { Segment, TrackPoint } from "@personal-tracker/shared/sport";
import type { Track } from "@we-gold/gpxjs";

import { lineString } from "@turf/helpers";
import simplify from "@turf/simplify";
import { parseGPXWithCustomParser } from "@we-gold/gpxjs";
import { DOMParser } from "xmldom-qsa";

const customDOMParser = (txt: string): Document | null => new DOMParser().parseFromString(txt, "text/xml");

// ±15 s window → 30 s total; increase for more smoothing, decrease for more detail
const PACE_WINDOW_HALF_SEC = 15;

// Douglas-Peucker tolerance in degrees (~5 m); drops redundant points while keeping the track's shape
const SIMPLIFY_TOLERANCE = 0.00005;

// On long straight stretches simplify() can keep just the two endpoints — re-inject points so
// consecutive kept points are never more than this far apart (chart hover needs a minimum density)
const MAX_POINT_GAP_METERS = 10;

// gpxjs default (0.000215 m/ms ≈ 0.77 km/h) undercounts moving time on walking/hiking-pace tracks
// with short (1-2s) sampling intervals, since GPS jitter drops many intervals' windowed avg speed
// below it. Both thresholds were tuned by sweeping against Strava-reported moving time across
// 7 runs, 12 walks and 13 hikes: 0.000215 was already near-optimal for running (mean abs err ~1%),
// while 0.0001 m/ms (~0.36 km/h) minimized error for walking and hiking alike (mean abs err ~1.6%).
const DEFAULT_AVG_SPEED_THRESHOLD_M_PER_MS = 0.000215;
const SLOW_ACTIVITY_AVG_SPEED_THRESHOLD_M_PER_MS = 0.0001;
const SLOW_ACTIVITY_TYPES = new Set(["walking", "hiking"]);

// Points slower than this pace are candidates for a "pause" segment (walking/stopped stretches).
const PAUSE_PACE_THRESHOLD_SEC_PER_KM = 600; // 10:00 /km

// Slow stretches shorter than this are treated as noise (GPS jitter, a red light) rather than a
// real pause, and get merged back into the surrounding running segment.
const MIN_PAUSE_DURATION_SEC = 10;

// Fast stretches shorter than this — e.g. a few steps taken mid-pause — are treated as noise
// rather than a real resumption of running, and get merged back into the surrounding pause.
const MIN_RUNNING_DURATION_SEC = 45;

// Segments are only meaningful for activities meant to be run continuously — walking/hiking
// tracks are slow throughout, so a pace-based split wouldn't say anything useful.
const SEGMENT_DETECTION_TYPES = new Set(["running"]);

// Matches the label detectSegments assigns a running segment by default (see below). Used by
// cropSegments to tell whether the user has customized any label before renumbering.
const DEFAULT_SEGMENT_LABEL = /^Segment #\d+$/;

function getAvgSpeedThreshold(activityType?: string): number {
	return activityType && SLOW_ACTIVITY_TYPES.has(activityType)
		? SLOW_ACTIVITY_AVG_SPEED_THRESHOLD_M_PER_MS
		: DEFAULT_AVG_SPEED_THRESHOLD_M_PER_MS;
}

// Walks the gaps left between kept points and re-inserts original indices so no gap exceeds
// MAX_POINT_GAP_METERS. Relies on distanceFromStart being monotonically increasing.
function densifyIndices(points: { distanceFromStart: number }[], keptIndices: number[]): number[] {
	const result: number[] = [];

	for (let i = 0; i < keptIndices.length; i++) {
		const from = keptIndices[i];
		result.push(from);

		const to = keptIndices[i + 1];
		if (to === undefined) break;

		const gap = points[to].distanceFromStart - points[from].distanceFromStart;
		const extraCount = Math.floor(gap / MAX_POINT_GAP_METERS);

		let cursor = from;
		for (let s = 1; s <= extraCount; s++) {
			const targetDist = points[from].distanceFromStart + s * MAX_POINT_GAP_METERS;
			while (cursor < to && points[cursor].distanceFromStart < targetDist) cursor++;
			if (cursor > from && cursor < to) result.push(cursor);
		}
	}

	return result;
}

function simplifyPoints<T extends { lat: number; lon: number; distanceFromStart: number }>(points: T[]): T[] {
	if (points.length <= 2) return points;

	const line = lineString(points.map((p) => [p.lon, p.lat]));
	const { coordinates } = simplify(line, { tolerance: SIMPLIFY_TOLERANCE, highQuality: true }).geometry;

	// simplify() only drops points, it never moves or creates them, so a forward scan can find
	// each kept coordinate's original index, in order.
	let cursor = 0;
	const keptIndices = coordinates.map(([lon, lat]) => {
		while (cursor < points.length - 1 && !(points[cursor].lon === lon && points[cursor].lat === lat)) {
			cursor++;
		}
		return cursor++;
	});

	return densifyIndices(points, keptIndices).map((i) => points[i]);
}

function buildTrackPoints(track: Track) {
	const { points } = track;
	const avgSpeedMs = track.duration.movingDuration > 0 ? track.distance.total / track.duration.movingDuration : 0;

	return points.map((point, i) => {
		const distanceFromStart = track.distance.cumulative[i] ?? 0;

		let pace: number | undefined;
		let isSuspect: boolean | undefined;

		if (point.time) {
			const tMs = point.time.getTime();
			const winStart = tMs - PACE_WINDOW_HALF_SEC * 1000;
			const winEnd = tMs + PACE_WINDOW_HALF_SEC * 1000;

			// Walk left to find the earliest point still inside the window
			let lo = i;
			for (let j = i - 1; j >= 0; j--) {
				const t = points[j].time;
				if (!t || t.getTime() < winStart) break;
				lo = j;
			}

			// Walk right to find the latest point still inside the window
			let hi = i;
			for (let j = i + 1; j < points.length; j++) {
				const t = points[j].time;
				if (!t || t.getTime() > winEnd) break;
				hi = j;
			}

			if (lo !== hi) {
				const timeDiff = (points[hi].time!.getTime() - points[lo].time!.getTime()) / 1000; // seconds
				const distDiff = (track.distance.cumulative[hi] ?? 0) - (track.distance.cumulative[lo] ?? 0); // meters

				if (timeDiff > 0 && distDiff > 0) {
					const speedMs = distDiff / timeDiff;
					pace = Math.round(timeDiff / (distDiff / 1000)); // seconds per km
					if (speedMs > avgSpeedMs * 5) isSuspect = true;
				}
			}
		}

		return {
			id: `pt-${i}`,
			lat: point.latitude,
			lon: point.longitude,
			...(point.elevation != null ? { ele: point.elevation } : {}),
			...(point.time ? { time: point.time.toISOString() } : {}),
			distanceFromStart: Math.round(distanceFromStart),
			...(pace !== undefined ? { pace } : {}),
			...(isSuspect ? { isSuspect } : {}),
		};
	});
}

// Walks points in order, classifying each by its already-computed pace, and merges consecutive
// same-state points into segments. Pause segments shorter than MIN_PAUSE_DURATION_SEC are
// dropped (merged back into the surrounding running state) as likely noise. Returns undefined
// when the whole activity is a single segment (nothing worth storing).
export function detectSegments(
	points: { time?: string; pace?: number }[],
	startTime: Date,
): { time: number; type: "running" | "pause"; label?: string }[] | undefined {
	type Group = { type: "running" | "pause"; startSec: number; endSec: number };

	const groups: Group[] = [];
	let currentType: "running" | "pause" = "running";

	for (const point of points) {
		if (!point.time) continue;
		const elapsedSec = (new Date(point.time).getTime() - startTime.getTime()) / 1000;
		if (point.pace !== undefined) {
			currentType = point.pace > PAUSE_PACE_THRESHOLD_SEC_PER_KM ? "pause" : "running";
		}

		const last = groups[groups.length - 1];
		if (last?.type === currentType) {
			last.endSec = elapsedSec;
		} else {
			groups.push({ type: currentType, startSec: elapsedSec, endSec: elapsedSec });
		}
	}

	const filtered: Group[] = [];
	for (const group of groups) {
		const duration = group.endSec - group.startSec;
		const tooShort =
			group.type === "pause" ? duration < MIN_PAUSE_DURATION_SEC : duration < MIN_RUNNING_DURATION_SEC;
		const last = filtered[filtered.length - 1];

		// Merging a too-short group into the previous one can make it adjacent to another group of
		// that same previous type (e.g. pause / brief run / pause collapsing into one pause) — the
		// type-merge check below then coalesces them together on a later iteration.
		if (tooShort && last) {
			last.endSec = group.endSec;
			continue;
		}

		if (last?.type === group.type) {
			last.endSec = group.endSec;
		} else {
			filtered.push({ ...group });
		}
	}

	if (filtered.length <= 1) return undefined;

	let runningCount = 0;
	return filtered.map((group) => ({
		time: Math.round(group.startSec),
		type: group.type,
		...(group.type === "running" ? { label: `Segment #${++runningCount}` } : {}),
	}));
}

export function extractGPXData(rawData: string, activityType?: string) {
	const [gpx] = parseGPXWithCustomParser(rawData, customDOMParser, {
		removeEmptyFields: true,
		avgSpeedThreshold: getAvgSpeedThreshold(activityType),
	});
	if (!gpx || gpx.tracks.length === 0) return null;

	const track = gpx.tracks[0];
	const rawPoints = buildTrackPoints(track);
	const distanceKm = track.distance.total / 1000;
	// From the points' times: gpxjs' totalDuration stops one point before the end
	const totalDuration = computeDurationSec(rawPoints) / 60;
	const movingDuration = track.duration.movingDuration / 60;
	const pace = distanceKm > 0 ? totalDuration / distanceKm : 0;
	let plainDateTime;
	const startTime = gpx.tracks[0].points[0].time;
	if (startTime) {
		const instant = Temporal.Instant.from(startTime.toISOString());
		const zoned = instant.toZonedDateTimeISO("Europe/Paris");
		plainDateTime = zoned.toPlainDateTime();
	}

	const segments =
		activityType && SEGMENT_DETECTION_TYPES.has(activityType) && startTime
			? detectSegments(rawPoints, startTime)
			: undefined;

	return {
		date: plainDateTime,
		details: {
			distance: Math.round(distanceKm * 100) / 100,
			movingDuration: Math.round(movingDuration),
			totalDuration: Math.round(totalDuration),
			pace: Math.round(pace * 100) / 100,
			...(track.elevation.positive != null ? { elevationGain: Math.round(track.elevation.positive) } : {}),
			...(track.elevation.negative != null ? { elevationLoss: Math.round(track.elevation.negative) } : {}),
		},
		points: simplifyPoints(rawPoints),
		...(segments ? { segments } : {}),
	};
}

function computeDurationSec(points: { time?: string | null }[]): number {
	const first = points.find((p) => p.time);
	const last = [...points].reverse().find((p) => p.time);
	if (!first?.time || !last?.time) return 0;
	return (new Date(last.time).getTime() - new Date(first.time).getTime()) / 1000;
}

// Classifies each interval by actual point-to-point speed against the same per-activity-type
// threshold extractGPXData uses for the stored movingDuration (getAvgSpeedThreshold) — NOT
// PAUSE_PACE_THRESHOLD_SEC_PER_KM, which is a running-specific "walking break mid-run" cutoff
// (10:00/km) too strict for a walk/hike's natural pace, or a runner's genuine recovery stretch.
function computeMovingDurationSec(
	points: { time?: string | null; distanceFromStart?: number }[],
	avgSpeedThresholdMPerMs: number,
): number {
	let movingSec = 0;
	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		if (!prev.time || !curr.time) continue;
		const dtMs = new Date(curr.time).getTime() - new Date(prev.time).getTime();
		if (dtMs <= 0) continue;
		const dDist = (curr.distanceFromStart ?? 0) - (prev.distanceFromStart ?? 0);
		if (dDist / dtMs >= avgSpeedThresholdMPerMs) movingSec += dtMs / 1000;
	}
	return movingSec;
}

function computeElevationDelta(points: { ele?: number | null }[]): { gain?: number; loss?: number } {
	if (!points.some((p) => p.ele != null)) return {};

	let gain = 0;
	let loss = 0;
	for (let i = 1; i < points.length; i++) {
		const prevEle = points[i - 1].ele;
		const currEle = points[i].ele;
		if (prevEle == null || currEle == null) continue;
		const delta = currEle - prevEle;
		if (delta > 0) gain += delta;
		else loss += -delta;
	}
	return { gain: Math.round(gain), loss: Math.round(loss) };
}

// A segment strictly active before the new start (time < offsetSec, and no segment starts
// exactly at offsetSec) is re-inserted at time 0 so the cropped window doesn't lose track of
// what it was mid-way through (e.g. cropping out part of a pause shouldn't make the track look
// like it starts running). Its label is dropped since it described the pre-crop timing. Segments
// entirely outside the new range are removed; one that already starts exactly at the new start
// keeps its own label unchanged.
//
// If the crop removed a leading segment, the remaining ones keep their old, now-stale numbers
// (e.g. "Segment #2" surviving alone). When every existing label is still exactly the
// auto-generated default — i.e. the user never renamed any of them — it's safe to renumber from
// scratch; if even one was customized, labels are left untouched rather than guessing.
export function cropSegments(
	segments: Segment[] | undefined,
	offsetSec: number,
	durationSec: number,
): Segment[] | undefined {
	if (!segments || segments.length === 0) return undefined;

	const hasSegmentAtNewStart = segments.some((s) => s.time === offsetSec);
	const active = hasSegmentAtNewStart ? undefined : [...segments].reverse().find((s) => s.time < offsetSec);
	const rest = segments
		.filter((s) => s.time >= offsetSec && s.time <= offsetSec + durationSec)
		.map((s) => ({ ...s, time: Math.round(s.time - offsetSec) }));

	let cropped = active ? [{ time: 0, type: active.type }, ...rest] : rest;
	if (cropped.length === 0) return undefined;

	const allLabelsAreDefault = segments
		.filter((s) => s.label != null)
		.every((s) => DEFAULT_SEGMENT_LABEL.test(s.label!));

	if (allLabelsAreDefault && offsetSec > 0) {
		let runningCount = 0;
		cropped = cropped.map((s) => (s.type === "running" ? { ...s, label: `Segment #${++runningCount}` } : s));
	}

	return cropped;
}

// Crops an already-processed activity's points down to [startIndex, endIndex] and recomputes
// details/segments from that range — no re-parsing of the original GPX is involved (see
// simplifyPoints/extractGPXData for where the stored points already come from).
export function cropActivity(
	points: TrackPoint[],
	segments: Segment[] | undefined,
	startIndex: number,
	endIndex: number,
	activityType?: string,
) {
	const slice = points.slice(startIndex, endIndex + 1);
	const startDistance = slice[0].distanceFromStart ?? 0;
	const croppedPoints = slice.map((p) => ({
		...p,
		distanceFromStart: Math.round((p.distanceFromStart ?? 0) - startDistance),
	}));

	const totalDurationSec = computeDurationSec(croppedPoints);
	const movingDurationSec = computeMovingDurationSec(croppedPoints, getAvgSpeedThreshold(activityType));
	const distanceKm = (croppedPoints[croppedPoints.length - 1].distanceFromStart ?? 0) / 1000;
	const totalDuration = Math.round(totalDurationSec / 60);
	const { gain, loss } = computeElevationDelta(croppedPoints);

	const originalStartTime = points[0].time;
	const offsetSec =
		originalStartTime && slice[0].time
			? (new Date(slice[0].time).getTime() - new Date(originalStartTime).getTime()) / 1000
			: 0;

	return {
		points: croppedPoints,
		segments: cropSegments(segments, offsetSec, totalDurationSec),
		details: {
			distance: Math.round(distanceKm * 100) / 100,
			movingDuration: Math.round(movingDurationSec / 60),
			totalDuration,
			pace: distanceKm > 0 ? Math.round((totalDuration / distanceKm) * 100) / 100 : 0,
			...(gain != null ? { elevationGain: gain } : {}),
			...(loss != null ? { elevationLoss: loss } : {}),
		},
	};
}

export function buildGpxKey(activityId: string, date: Temporal.PlainDateTime) {
	return `personal-tracker/sport/${date.year}/${date.toPlainDate().toString()}-${activityId}.gpx`;
}

export function buildThumbnailKey(activityId: string, date: Temporal.PlainDateTime) {
	return `personal-tracker/sport/${date.year}/${date.toPlainDate().toString()}-${activityId}-thumbnail.avif`;
}
