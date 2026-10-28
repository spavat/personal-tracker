import type { LifespanDisposeCause, LifespanObjectWithStatus } from "@personal-tracker/shared/lifespan";

type TimelineSegmentKind = "in_use" | "paused" | "ended";

interface TimelineSegment {
	kind: TimelineSegmentKind;
	from: string;
	to: string;
	ongoing: boolean;
}

export interface TimelineData {
	segments: Array<TimelineSegment>;
	notStarted: boolean;
	disposedAt?: { date: string; cause?: LifespanDisposeCause };
}

const USAGE_EVENT_TYPES = new Set(["start_usage", "pause_usage", "end_usage", "dispose"]);

const SEGMENT_KIND_BY_EVENT_TYPE: Record<string, TimelineSegmentKind> = {
	start_usage: "in_use",
	pause_usage: "paused",
	end_usage: "ended",
};

export function computeTimelineSegments(events: LifespanObjectWithStatus["events"], today: string): TimelineData {
	const usageEvents = [...events]
		.filter((event) => USAGE_EVENT_TYPES.has(event.type))
		.sort((a, b) => a.date.localeCompare(b.date) || (a.created ?? "").localeCompare(b.created ?? ""));

	if (usageEvents.length === 0) {
		return { segments: [], notStarted: true };
	}

	const segments: Array<TimelineSegment> = [];
	let disposedAt: TimelineData["disposedAt"];

	for (let i = 0; i < usageEvents.length; i++) {
		const event = usageEvents[i];

		if (event.type === "dispose") {
			disposedAt = { date: event.date, cause: event.cause };
			break;
		}

		const next = usageEvents[i + 1];
		segments.push({
			kind: SEGMENT_KIND_BY_EVENT_TYPE[event.type],
			from: event.date,
			to: next?.date ?? today,
			ongoing: !next,
		});
	}

	return { segments, notStarted: false, disposedAt };
}

function firstStartUsageDate(object: LifespanObjectWithStatus): string | undefined {
	return object.events
		.filter((event) => event.type === "start_usage")
		.map((event) => event.date)
		.sort()[0];
}

// Order inside a category: by type (untyped last), then by first usage date asc (never used last)
export function compareObjectsForTimeline(a: LifespanObjectWithStatus, b: LifespanObjectWithStatus): number {
	const typeA = a.type || null;
	const typeB = b.type || null;
	if (typeA !== typeB) {
		if (!typeA) return 1;
		if (!typeB) return -1;
		const byType = typeA.localeCompare(typeB, undefined, { sensitivity: "base" });
		if (byType !== 0) return byType;
	}
	const startA = firstStartUsageDate(a);
	const startB = firstStartUsageDate(b);
	if (startA === startB) return 0;
	if (!startA) return 1;
	if (!startB) return -1;
	return startA.localeCompare(startB);
}

export function earliestEventDate(objects: Array<LifespanObjectWithStatus>): string | null {
	let earliest: string | null = null;
	for (const object of objects) {
		for (const event of object.events) {
			if (!earliest || event.date < earliest) {
				earliest = event.date;
			}
		}
	}
	return earliest;
}

// An object is in the period when its lifespan overlaps it, even without any event inside the period
// (e.g. started before and still in use). The lifespan ends at its disposal, or today when still owned.
export function isObjectInPeriod(
	object: LifespanObjectWithStatus,
	period: { start: string; end: string },
	today: string,
): boolean {
	if (object.events.length === 0) {
		return false;
	}
	const dates = object.events.map((event) => event.date).sort();
	const lifeStart = dates[0];
	const lifeEnd = object.events.some((event) => event.type === "dispose") ? dates.at(-1)! : today;
	return lifeStart <= period.end && lifeEnd >= period.start;
}

export function dateToPercent(date: string, rangeStart: string, rangeEnd: string): number {
	const start = Temporal.PlainDate.from(rangeStart);
	const end = Temporal.PlainDate.from(rangeEnd);
	const target = Temporal.PlainDate.from(date);

	const totalDays = start.until(end, { largestUnit: "days" }).days;
	if (totalDays <= 0) {
		return 0;
	}
	const elapsedDays = start.until(target, { largestUnit: "days" }).days;
	return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
}

export type PeriodPreset = "current_year" | "last_2_years" | "last_5_years" | "last_10_years";

export function periodPresetRange(preset: PeriodPreset): { start: string; end: string } {
	const today = Temporal.Now.plainDateISO();
	const end = today.toString();
	switch (preset) {
		case "current_year":
			return { start: `${today.year}-01-01`, end };
		case "last_2_years":
			return { start: today.subtract({ years: 2 }).toString(), end };
		case "last_5_years":
			return { start: today.subtract({ years: 5 }).toString(), end };
		case "last_10_years":
			return { start: today.subtract({ years: 10 }).toString(), end };
	}
}

export interface YearBand {
	label: string;
	startPercent: number;
	endPercent: number;
}

const MAX_YEAR_BANDS = 14;
const NICE_YEAR_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

export function yearBands(rangeStart: string, rangeEnd: string): Array<YearBand> {
	const start = Temporal.PlainDate.from(rangeStart);
	const end = Temporal.PlainDate.from(rangeEnd);

	const totalYears = Math.max(1, end.year - start.year);
	const step = NICE_YEAR_STEPS.find((s) => totalYears / s <= MAX_YEAR_BANDS) ?? NICE_YEAR_STEPS.at(-1)!;
	const firstBandYear = Math.floor(start.year / step) * step;

	const bands: Array<YearBand> = [];
	for (let year = firstBandYear; year <= end.year; year += step) {
		const bandStart = Temporal.PlainDate.from({ year, month: 1, day: 1 });
		const bandEnd = Temporal.PlainDate.from({ year: year + step, month: 1, day: 1 });

		const startDate = Temporal.PlainDate.compare(bandStart, start) < 0 ? start : bandStart;
		const endDate = Temporal.PlainDate.compare(bandEnd, end) > 0 ? end : bandEnd;
		if (Temporal.PlainDate.compare(startDate, endDate) >= 0) {
			continue;
		}

		bands.push({
			label: step === 1 ? String(year) : `${year}-${year + step - 1}`,
			startPercent: dateToPercent(startDate.toString(), rangeStart, rangeEnd),
			endPercent: dateToPercent(endDate.toString(), rangeStart, rangeEnd),
		});
	}
	return bands;
}
