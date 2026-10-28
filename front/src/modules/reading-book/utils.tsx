import { BookOverview } from "@personal-tracker/shared/reading-book";

import { formatDate } from "../../utils";
import { FrontReading } from "./types";

/**
 * Retrieves the first and last dates from the chapters of a book.
 * @param book The book to retrieve the dates from.
 * @returns An object with the first and last dates.
 */
function getFirstAndLastDates({ details }: { details: Array<FrontReading.ReadDetails> }): {
	firstDate: string;
	lastDate: string;
} {
	const setDates = new Set<string>();
	details.forEach((d) => {
		d.context?.forEach(({ date }) => setDates.add(date));
	});
	const arrDates = [...setDates].sort((a, b) => a.localeCompare(b));
	const firstDate = arrDates[0] ?? "";
	const lastDate = arrDates.length > 0 ? arrDates[arrDates.length - 1] : "";

	return {
		firstDate: firstDate.length === 10 ? firstDate : "",
		lastDate: lastDate.length === 10 ? lastDate : "",
	};
}

function getDaysFromReadings(readings: Array<FrontReading.ReadDetails>): Array<string> {
	const dates: Array<string> = [];
	(readings ?? []).forEach((reading) => {
		dates.push(...(reading.context ?? []).map((c) => c.date));
	});
	return dates;
}

/**
 * Calculates the number of unique days in a period.
 * @param chapters The chapters to calculate the unique days from.
 * @returns The number of unique days.
 */
function getUniqueDays(chapters: Array<FrontReading.ReadDetails>): number {
	const setDays = new Set(getDaysFromReadings(chapters).filter((d) => d.length === 10));
	return setDays.size;
}

/**
 * Returns a string representing the duration of a book's readings.
 * The duration is expressed as a range of dates, with the number of unique days
 * in parentheses.
 * @param book The book to get the duration for.
 * @returns A string representing the duration of the book's readings.
 */
export function getReadingDuration({ details }: { details: Array<FrontReading.ReadDetails> }) {
	const { firstDate, lastDate } = getFirstAndLastDates({ details });
	let dateString = "";

	if (!firstDate) {
		return "";
	}
	if (firstDate === lastDate) {
		dateString = `${formatDate(firstDate)} (1 jour)`;
	} else {
		const uniqueDays = getUniqueDays(details);
		dateString = `${formatDate(firstDate)} - ${formatDate(lastDate)} (${uniqueDays} jours)`;
	}
	return dateString;
}

export function getReadingDurationFromDates(dates: Array<string>) {
	// unicity
	const uniqueDates = Array.from(new Set(dates));
	// sort
	const sortedDates = uniqueDates.sort((a, b) => a.localeCompare(b));
	if (sortedDates.length === 0) {
		return "";
	}
	const firstDate = sortedDates[0];
	const lastDate = sortedDates[sortedDates.length - 1];

	let dateString = "";
	if (firstDate === lastDate) {
		dateString = `${formatDate(firstDate)} (1 jour)`;
	} else {
		dateString = `${formatDate(firstDate)} - ${formatDate(lastDate)} (${sortedDates.length} jours)`;
	}
	return dateString;
}

export function getReadingIcons(tags: Array<string>, { displayIcon }: { displayIcon: boolean }) {
	if (!displayIcon) {
		return "";
	}

	let icon = "";
	if (tags.includes("dodo")) {
		icon += "🛌";
	}
	if (tags.includes("metro")) {
		icon += "🚇";
	}
	if (tags.includes("parc")) {
		icon += "🌲";
	}
	if (tags.includes("eurostar")) {
		icon += "🚄";
	}
	if (tags.includes("maison") || tags.includes("viserny")) {
		icon += "🏠";
	}
	if (tags.includes("train")) {
		icon += "🚅";
	}
	if (tags.includes("bus")) {
		icon += "🚌";
	}
	if (tags.includes("hotel")) {
		icon += "🏨";
	}
	if (tags.includes("gare")) {
		icon += "🚉";
	}
	return icon;
}

type Part = {
	id: string;
	title: string;
	content?: Part[];
};
export const parseTocText = (text: string): Part[] => {
	const lines = text.split("\n").filter((line) => line.trim() !== "");

	const getDepth = (line: string): number => {
		let depth = 0;
		for (const char of line) {
			if (char === "\t") depth++;
			else break;
		}
		return depth;
	};

	const buildTree = (
		lines: { depth: number; title: string }[],
		start: number,
		currentDepth: number,
	): { parts: Part[]; nextIndex: number } => {
		const parts: Part[] = [];
		let i = start;

		while (i < lines.length) {
			const { depth, title } = lines[i];

			if (depth < currentDepth) break;

			if (depth === currentDepth) {
				// Peek ahead to see if next line is deeper (meaning this is a bloc)
				const nextDepth = i + 1 < lines.length ? lines[i + 1].depth : -1;

				if (nextDepth > currentDepth) {
					// It's a bloc — collect its children
					const { parts: content, nextIndex } = buildTree(lines, i + 1, depth + 1);
					parts.push({ id: crypto.randomUUID(), title, content });
					i = nextIndex;
				} else {
					parts.push({ id: crypto.randomUUID(), title });
					i++;
				}
			} else {
				// depth > currentDepth: skip orphan (shouldn't happen in valid input)
				i++;
			}
		}

		return { parts, nextIndex: i };
	};

	const parsed = lines.map((line) => ({
		depth: getDepth(line),
		title: line.trim(),
	}));

	const { parts } = buildTree(parsed, 0, 0);
	return parts;
};

export function getLongestConsecutiveStreak(books: Array<BookOverview>) {
	const dates = new Set<string>();

	books.forEach((book) => {
		book.readingDates.forEach((date) => {
			if (date.length === 10) {
				dates.add(date);
			}
		});
	});

	const sortedDates = Array.from(dates).sort((a, b) => a.localeCompare(b));

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

function isConsecutive(date1: string, date2: string) {
	const d1 = new Date(date1);
	const d2 = new Date(date2);
	const oneDay = 24 * 60 * 60 * 1000; // one day in milliseconds
	return d2.getTime() - d1.getTime() === oneDay;
}

export function getStatusIcon(item: any, { color }: { color: boolean }) {
	const colorSuffix = color ? "-color" : "";
	let status = <></>;
	if (item.status === "complete") {
		status = <i className={`complete${colorSuffix} fa-solid fa-circle-check`} style={{ color: "green" }}></i>;
	} else if (item.status === "abandoned") {
		status = <i className={`dev-abandoned${colorSuffix} fa-solid fa-ban`} style={{ color: "red" }}></i>;
	}
	return status;
}
