import type { Book, ReadingDetails, ReadingModelItem } from "@personal-tracker/shared/reading-book";

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
		// first read first, the readings not started yet last
		readings: (edition?.readings ?? [])
			.toSorted((a, b) => (a.entries[0]?.date ?? "9999").localeCompare(b.entries[0]?.date ?? "9999"))
			.map((reading) => ({
				id: reading.id,
				status: reading.status,
				details: toDetails(reading.entries),
			})),
	};
}

// entries (sorted by date) → one detail per chapter, in the order the chapters were first read
export function toDetails(entries: Array<Omit<Entry, "readingId">>): ReadingDetails[] {
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
