import type { Book, ReadingDetails, ReadingModelItem } from "@personal-tracker/shared/reading-book";

import { randomUUID } from "crypto";

export type ReadingStatus = Book["editions"][number]["readings"][number]["status"];
export type EditionType = Book["editions"][number]["type"];

export interface Entry {
	readingId: string;
	chapterId: string;
	date: string;
	tags: string[];
}

type CreditRow = { role: string; creditedAs: string | null; entity: { id: string; name: string } | null };
const credits = (rows: CreditRow[], role: string) =>
	rows
		.filter((row) => row.role === role && row.entity)
		.map(({ entity, creditedAs }) => ({ entityId: entity!.id, name: entity!.name, creditedAs }));

// Shape loaded by BookRepository (book + contributors + models, editions → readings → entries)
export interface BookRow {
	id: string;
	title: string;
	originalLanguage: string | null;
	originalYear: number | null;
	country: string | null;
	contributors: CreditRow[];
	models: Array<{ id: string; name: string; tree: ReadingModelItem[] }>;
	series: Array<{
		position: number;
		positionLabel: string | null;
		series: {
			id: string;
			title: string;
			parentItems: Array<{ series: { id: string; title: string } | null }>;
		} | null;
	}>;
	editions: Array<{
		id: string;
		title: string | null;
		publisher: { id: string; name: string } | null;
		collection: string | null;
		contributors: CreditRow[];
		language: string | null;
		pages: number | null;
		type: EditionType;
		isbn: string | null;
		year: number | null;
		coverKey: string | null;
		modelId: string | null;
		readings: Array<{ id: string; status: ReadingStatus; entries: Array<Omit<Entry, "readingId">> }>;
	}>;
}

export function toBook(row: BookRow): Book {
	return {
		id: row.id,
		book: row.title,
		authors: credits(row.contributors, "author"),
		originalLanguage: row.originalLanguage ?? "",
		originalYear: row.originalYear,
		country: row.country ?? "",
		models: row.models.map(({ id, name, tree }) => ({ id, name, tree })),
		series: row.series
			.filter(({ series }) => series)
			.map(({ position, positionLabel, series }) => ({
				id: series!.id,
				title: series!.title,
				position,
				positionLabel,
				// the series holding it
				parents: series!.parentItems
					.flatMap(({ series: parent }) => (parent ? [{ id: parent.id, title: parent.title }] : []))
					.toSorted((a, b) => a.title.localeCompare(b.title)),
			}))
			.toSorted((a, b) => a.title.localeCompare(b.title)),
		editions: row.editions.map((edition) => ({
			id: edition.id,
			title: edition.title,
			publisher: edition.publisher && { id: edition.publisher.id, name: edition.publisher.name },
			collection: edition.collection,
			translators: credits(edition.contributors, "translator"),
			language: edition.language,
			pages: edition.pages,
			type: edition.type,
			isbn: edition.isbn,
			year: edition.year,
			cover: coverUrl(edition.id, edition.coverKey),
			modelId: edition.modelId,
			// first read first, the readings not started yet last
			readings: edition.readings
				.toSorted((a, b) => (a.entries[0]?.date ?? "9999").localeCompare(b.entries[0]?.date ?? "9999"))
				.map((reading) => ({
					id: reading.id,
					status: reading.status,
					details: toDetails(reading.entries),
				})),
		})),
	};
}

// Covers are stored as personal-tracker/reading-book/edition/<editionId>.<version>.avif and served through
// the images proxy; the version changes with each upload, so a replaced cover isn't served from the cache.
export const COVER_URL_PREFIX = "/images/reading-book/edition/";

export function coverKey(editionId: string, version: string) {
	return `personal-tracker/reading-book/edition/${editionId}.${version}.avif`;
}

export function coverUrl(editionId: string, key: string | null) {
	return key ? `${COVER_URL_PREFIX}${editionId}?v=${key.split(".").at(-2)}` : null;
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
