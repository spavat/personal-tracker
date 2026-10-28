import { randomUUID } from "crypto";

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
