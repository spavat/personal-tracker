import { describe, expect, it } from "vitest";

import {
	buildGpxKey,
	buildThumbnailKey,
	cropActivity,
	cropSegments,
	detectSegments,
	extractGPXData,
} from "./sport.entity";

const date = Temporal.PlainDateTime.from("2024-06-01T10:30:00");

describe("buildGpxKey / buildThumbnailKey", () => {
	it("builds a year-partitioned gpx key", () => {
		expect(buildGpxKey("act-1", date)).toBe("personal-tracker/sport/2024/2024-06-01-act-1.gpx");
	});

	it("builds the matching thumbnail key", () => {
		expect(buildThumbnailKey("act-1", date)).toBe("personal-tracker/sport/2024/2024-06-01-act-1-thumbnail.avif");
	});
});

describe("extractGPXData", () => {
	it("returns null when the file has no track", () => {
		const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="test"></gpx>`;
		expect(extractGPXData(gpx)).toBeNull();
	});

	it("measures the total duration from the first to the last point", () => {
		const points = Array.from(
			{ length: 61 },
			(_, i) =>
				`<trkpt lat="${45 + (i * 30) / 111_195}" lon="5.7"><time>${new Date(Date.parse("2024-06-01T10:00:00Z") + i * 10_000).toISOString()}</time></trkpt>`,
		);
		const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="test"><trk><trkseg>${points.join("")}</trkseg></trk></gpx>`;

		// 60 intervals of 30 m and 10 s
		expect(extractGPXData(gpx, "running")?.details).toMatchObject({ distance: 1.8, totalDuration: 10, pace: 5.56 });
	});
});

describe("detectSegments", () => {
	const startTime = new Date("2024-06-01T10:00:00Z");

	function buildPoints(paces: (number | undefined)[]) {
		return paces.map((pace, i) => ({
			time: new Date(startTime.getTime() + i * 1000).toISOString(),
			...(pace !== undefined ? { pace } : {}),
		}));
	}

	it("returns undefined when the whole activity is running", () => {
		const points = buildPoints(Array.from({ length: 20 }, () => 300));
		expect(detectSegments(points, startTime)).toBeUndefined();
	});

	it("flags a slow stretch lasting past the minimum duration as a pause", () => {
		const points = buildPoints([
			...Array.from({ length: 10 }, () => 300),
			...Array.from({ length: 15 }, () => 700), // 10s..24s, 14s of slow pace
			...Array.from({ length: 50 }, () => 300), // 25s..74s, 49s of running — past MIN_RUNNING_DURATION_SEC
		]);

		expect(detectSegments(points, startTime)).toEqual([
			{ time: 0, type: "running", label: "Segment #1" },
			{ time: 10, type: "pause" },
			{ time: 25, type: "running", label: "Segment #2" },
		]);
	});

	it("ignores a slow stretch shorter than the minimum pause duration", () => {
		const points = buildPoints([
			...Array.from({ length: 10 }, () => 300),
			...Array.from({ length: 5 }, () => 700), // 10s..14s, 4s of slow pace
			...Array.from({ length: 50 }, () => 300),
		]);

		expect(detectSegments(points, startTime)).toBeUndefined();
	});

	it("merges brief running blips between pauses back into one continuous pause", () => {
		const points = buildPoints([
			...Array.from({ length: 60 }, () => 300), // 0s..59s: real run
			...Array.from({ length: 120 }, () => 700), // 60s..179s: pause
			...Array.from({ length: 20 }, () => 300), // 180s..199s: 20s blip — too short to count as running
			...Array.from({ length: 120 }, () => 700), // 200s..319s: pause
			...Array.from({ length: 60 }, () => 300), // 320s..379s: real run
		]);

		expect(detectSegments(points, startTime)).toEqual([
			{ time: 0, type: "running", label: "Segment #1" },
			{ time: 60, type: "pause" },
			{ time: 320, type: "running", label: "Segment #2" },
		]);
	});

	it("defaults to running while pace is not yet known", () => {
		const points = buildPoints([undefined, undefined, ...Array.from({ length: 10 }, () => 300)]);
		expect(detectSegments(points, startTime)).toBeUndefined();
	});
});

describe("cropSegments", () => {
	it("returns undefined when there are no segments", () => {
		expect(cropSegments(undefined, 60, 120)).toBeUndefined();
	});

	it("drops segments outside the range and shifts the ones inside", () => {
		const segments = [
			{ time: 0, type: "running" as const, label: "Segment #1" },
			{ time: 90, type: "pause" as const },
		];

		// The re-seeded running segment is renumbered back to "Segment #1" since every label was
		// still a default one — see the "renumbers" tests below for the dedicated coverage.
		expect(cropSegments(segments, 60, 120)).toEqual([
			{ time: 0, type: "running", label: "Segment #1" },
			{ time: 30, type: "pause" },
		]);
	});

	it("returns undefined when the whole range falls outside every segment", () => {
		const segments = [{ time: 500, type: "running" as const }];
		expect(cropSegments(segments, 0, 100)).toBeUndefined();
	});

	it("renumbers default labels when a crop at the start drops a leading segment", () => {
		const segments = [
			{ time: 0, type: "running" as const, label: "Segment #1" },
			{ time: 60, type: "pause" as const },
			{ time: 120, type: "running" as const, label: "Segment #2" },
		];

		// Crop starts at 130s, past the first running segment entirely — only "Segment #2" survives
		// and should be renumbered to "Segment #1" rather than keeping its stale original number.
		expect(cropSegments(segments, 130, 100)).toEqual([{ time: 0, type: "running", label: "Segment #1" }]);
	});

	it("leaves labels untouched (and un-renumbered) when any of them was customized", () => {
		const segments = [
			{ time: 0, type: "running" as const, label: "Segment #1" },
			{ time: 60, type: "pause" as const },
			{ time: 120, type: "running" as const, label: "Sprint final" },
		];

		// "Sprint final" isn't a default label, so renumbering is skipped entirely — the re-seeded
		// segment still has no label of its own (same as the always-drops-label re-seed behavior)
		expect(cropSegments(segments, 130, 100)).toEqual([{ time: 0, type: "running" }]);
	});

	it("does not renumber when the crop only trims the end", () => {
		const segments = [
			{ time: 0, type: "running" as const, label: "Segment #1" },
			{ time: 60, type: "pause" as const },
			{ time: 120, type: "running" as const, label: "Segment #2" },
		];

		// offsetSec is 0 — nothing was removed from the start, so existing numbers stay valid
		expect(cropSegments(segments, 0, 100)).toEqual([
			{ time: 0, type: "running", label: "Segment #1" },
			{ time: 60, type: "pause" },
		]);
	});
});

describe("cropActivity", () => {
	const base = new Date("2024-06-01T10:00:00.000Z").getTime();
	const isoAt = (sec: number) => new Date(base + sec * 1000).toISOString();

	const points = [
		{ id: "pt-0", lat: 0, lon: 0, time: isoAt(0), distanceFromStart: 0 },
		{ id: "pt-1", lat: 0, lon: 0, time: isoAt(60), distanceFromStart: 1000, ele: 15 },
		{ id: "pt-2", lat: 0, lon: 0, time: isoAt(120), distanceFromStart: 2000, ele: 25 },
		{ id: "pt-3", lat: 0, lon: 0, time: isoAt(180), distanceFromStart: 3000, ele: 20 },
		{ id: "pt-4", lat: 0, lon: 0, time: isoAt(240), distanceFromStart: 4000 },
	];

	const segments = [
		{ time: 0, type: "running" as const, label: "Segment #1" },
		{ time: 90, type: "pause" as const },
	];

	it("rebases point distances and recomputes details for the cropped range", () => {
		const result = cropActivity(points, segments, 1, 3);

		expect(result.points.map((p) => p.distanceFromStart)).toEqual([0, 1000, 2000]);
		expect(result.details).toEqual({
			distance: 2,
			totalDuration: 2,
			movingDuration: 2,
			pace: 1,
			elevationGain: 10,
			elevationLoss: 5,
		});
	});

	it("uses the slower walking/hiking speed threshold to classify moving time", () => {
		// 15m in 100s (~0.15 m/s) — moving by the walking/hiking threshold, a stop by the default one
		const slowPoints = [
			{ id: "pt-0", lat: 0, lon: 0, time: isoAt(0), distanceFromStart: 0 },
			{ id: "pt-1", lat: 0, lon: 0, time: isoAt(100), distanceFromStart: 15 },
		];

		expect(cropActivity(slowPoints, undefined, 0, 1, "running").details.movingDuration).toBe(0);
		expect(cropActivity(slowPoints, undefined, 0, 1, "hiking").details.movingDuration).toBe(2);
	});

	it("rebases segments relative to the new start, dropping/re-seeding as needed", () => {
		const result = cropActivity(points, segments, 1, 3);

		// Both original labels were still defaults, so the re-seeded running segment is renumbered
		expect(result.segments).toEqual([
			{ time: 0, type: "running", label: "Segment #1" },
			{ time: 30, type: "pause" },
		]);
	});

	it("omits elevation fields when no point has elevation data", () => {
		const noElevation = points.map(({ ele: _ele, ...p }) => p);
		const result = cropActivity(noElevation, undefined, 1, 3);

		expect(result.details.elevationGain).toBeUndefined();
		expect(result.details.elevationLoss).toBeUndefined();
	});
});
