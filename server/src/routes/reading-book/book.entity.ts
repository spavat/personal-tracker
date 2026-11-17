import type { Book, BookOverview, ReadingDetails, ReadingModelItem } from "@personal-tracker/shared/reading-book";

import { randomUUID } from "crypto";

export type ReadingStatus = Book["readings"][number]["status"];

export interface Entry {
	readingId: string;
	chapterId: string;
	date: string;
	tags: string[];
}

// Shape loaded by BookRepository (book + contributors + editions → model, readings → entries)
export interface BookRow {
	id: string;
	title: string;
	country: string | null;
	contributors: Array<{ role: string; entity: { name: string } | null }>;
	editions: Array<{
		language: string | null;
		pages: number | null;
		model: { tree: ReadingModelItem[] } | null;
		readings: Array<{ id: string; status: ReadingStatus; entries: Array<Omit<Entry, "readingId">> }>;
	}>;
}

// API shape of a book (as stored in Mongo before): one edition per book for now
export function toBook(row: BookRow): Book {
	const edition = row.editions[0];
	return {
		id: row.id,
		book: row.title,
		author: row.contributors.filter(({ role }) => role === "author").map(({ entity }) => entity?.name ?? ""),
		language: edition?.language ?? "",
		country: row.country ?? "",
		pages: edition?.pages ?? null,
		model: edition?.model?.tree ?? [],
		readings: (edition?.readings ?? []).map((reading) => ({
			id: reading.id,
			status: reading.status,
			details: toDetails(reading.entries),
		})),
	};
}

// entries (sorted by date) → one detail per chapter, in the order the chapters were first read
function toDetails(entries: Array<Omit<Entry, "readingId">>): ReadingDetails[] {
	const details = new Map<string, ReadingDetails>();
	for (const { chapterId, date, tags } of entries) {
		const detail = details.get(chapterId) ?? { id: chapterId, context: [] };
		detail.context.push({ date, tags });
		details.set(chapterId, detail);
	}
	return [...details.values()];
}

// details → entry rows: the same chapter read twice the same day is one entry, tags merged
export function toEntries(readingId: string, details: ReadingDetails[]) {
	const entries = new Map<string, Entry>();
	let merged = 0;
	for (const detail of details) {
		for (const { date, tags } of detail.context) {
			const key = `${detail.id}|${date}`;
			const entry = entries.get(key);
			if (entry) {
				merged++;
				entry.tags = [...new Set([...entry.tags, ...tags])];
			} else {
				entries.set(key, { readingId, chapterId: detail.id, date, tags: [...new Set(tags)] });
			}
		}
	}
	return { entries: [...entries.values()], merged };
}

const inRange = (from: string, to: string) => (date: string) => date >= from && date <= to;
const contextDates = (details: ReadingDetails[]) =>
	[...new Set(details.flatMap((detail) => detail.context.map(({ date }) => date)))].sort();

// Same output as the former Mongo aggregation of BookRepository.findAll:
// - each reading gets its dates (from all its details), first and last read date;
// - with a period: only the readings with a date in it are kept, and in them only the details with a date in it;
// - the book's dates come from the kept details, and only the books with a date in the period are kept.
export function toBookOverviews(
	books: Book[],
	{ from, to, withReadingsDetails }: { from?: string; to?: string; withReadingsDetails: boolean },
): BookOverview[] {
	const period = from && to ? inRange(from, to) : undefined;
	const overviews: BookOverview[] = [];
	for (const book of books) {
		let readings = book.readings.map((reading) => {
			const readingDates = contextDates(reading.details);
			return {
				...reading,
				readingDates,
				firstReadDate: readingDates[0] ?? null,
				lastReadDate: readingDates.at(-1) ?? null,
			};
		});
		if (period) {
			readings = readings
				.filter(({ readingDates }) => readingDates.some(period))
				.map((reading) => ({
					...reading,
					details: reading.details.filter(({ context }) => context.some(({ date }) => period(date))),
				}));
		}
		const readingDates = contextDates(readings.flatMap(({ details }) => details));
		if (period && !readingDates.some(period)) {
			continue;
		}
		overviews.push({
			...book,
			readings: withReadingsDetails ? readings : readings.map(({ details: _details, ...reading }) => reading),
			readingDates,
			firstReadDate: readingDates[0] ?? null,
			lastReadDate: readingDates.at(-1) ?? null,
			nbReadings: readings.length,
		} as BookOverview);
	}
	return overviews;
}

// Mongo sort order: missing/null first, strings by code point, an array by its smallest element
// (largest when descending)
export function sortBookOverviews(books: BookOverview[], field: string, direction: string) {
	const sign = direction === "asc" ? 1 : -1;
	const valueOf = (book: BookOverview) => {
		const value = (book as Record<string, unknown>)[field];
		if (!Array.isArray(value)) return value;
		const sorted = value.toSorted(compare);
		return sign === 1 ? sorted[0] : sorted.at(-1);
	};
	return books.toSorted((a, b) => sign * compare(valueOf(a), valueOf(b)));
}

function compare(a: unknown, b: unknown): number {
	if (a === b || (a == null && b == null)) return 0;
	if (a === null || a === undefined) return -1;
	if (b === null || b === undefined) return 1;
	return (a as string | number) < (b as string | number) ? -1 : 1;
}

export function buildTitleMap(models: Array<any>) {
	const titleMap: Record<string, string> = {};
	for (const item of models) {
		if (item.title) {
			titleMap[item.id] = item.title;
		}
		if (item.content) {
			const childTitleMap = buildTitleMap(item.content);
			for (const [key, value] of Object.entries(childTitleMap)) {
				titleMap[key] = value;
			}
		}
	}
	return titleMap;
}

export function buildInitialReading() {
	return {
		id: randomUUID(),
		status: "in-progress" as const,
		details: [],
	};
}

function isConsecutive(date1: string, date2: string) {
	const d1 = new Date(`${date1}T00:00:00Z`);
	const d2 = new Date(`${date2}T00:00:00Z`);
	const oneDay = 24 * 60 * 60 * 1000; // one day in milliseconds
	return d2.getTime() - d1.getTime() === oneDay;
}

export function getLongestConsecutiveStreak(dates: Array<string>) {
	const sortedDates = dates.sort((a, b) => a.localeCompare(b));

	let longestStreak = 0;
	let longestStreakStart: string | null = null;
	let longestStreakEnd: string | null = null;

	let currentStreak = 0;
	let currentStreakStart: string | null = null;
	let currentStreakEnd: string | null = null;

	for (let i = 0; i < sortedDates.length; i++) {
		if (i === 0 || isConsecutive(sortedDates[i - 1], sortedDates[i])) {
			if (currentStreak === 0) {
				currentStreakStart = sortedDates[i];
			}
			currentStreak++;
			currentStreakEnd = sortedDates[i];
		} else {
			if (currentStreak > longestStreak) {
				longestStreak = currentStreak;
				longestStreakStart = currentStreakStart;
				longestStreakEnd = currentStreakEnd;
			}
			currentStreak = 1;
			currentStreakStart = sortedDates[i];
			currentStreakEnd = sortedDates[i];
		}
	}

	if (currentStreak > longestStreak) {
		longestStreak = currentStreak;
		longestStreakStart = currentStreakStart;
		longestStreakEnd = currentStreakEnd;
	}

	return {
		days: longestStreak,
		start: longestStreakStart,
		end: longestStreakEnd,
	};
}

export function median(numbers: number[]): number {
	if (numbers.length === 0) {
		throw new Error("Cannot calculate median of an empty array");
	}

	const sorted = [...numbers].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);

	return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
