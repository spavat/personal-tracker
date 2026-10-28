import { Reading } from "@personal-tracker/shared/reading-manga";

import { FrontManga } from "./types";

export function getReadingSummary(readings: Array<Reading>): string {
	const { chapters, volumes } = readings.reduce(
		(counts, reading) => {
			if (reading.type === "chapter") {
				counts.chapters++;
			} else if (reading.type === "volume") {
				counts.volumes++;
			}
			return counts;
		},
		{ chapters: 0, volumes: 0 },
	);

	let summary = "";
	if (volumes === 1) {
		summary += `${volumes} volume `;
	} else if (volumes > 1) {
		summary += `${volumes} volumes `;
	}
	if (chapters === 1) {
		summary += `${chapters} chapitre `;
	} else if (chapters > 1) {
		summary += `${chapters} chapitres `;
	}
	return summary;
}

export function getMangaPrefixName(reading: Reading): string {
	if (reading.name === "One-shot") {
		return "";
	}
	if (reading.type === "chapter") {
		return "C";
	} else if (reading.type === "volume") {
		return "T";
	}
	return "";
}

function compareForMerging(read1: Reading, read2: Reading): boolean {
	return (
		read1.date === read2.date &&
		read1.language === read2.language &&
		read1.origin === read2.origin &&
		read1.type === read2.type
	);
}

function buildMergedReadingName(val1: string, val2: string, { sort }: { sort: "asc" | "desc" }) {
	let name = "";
	if (sort === "asc") {
		name = `${val1}-${val2}`;
	} else {
		name = `${val2}-${val1}`;
	}
	return name;
}

export function mergeReadings<T extends FrontManga.MergedReading>(
	readings: Array<T>,
	{ sort }: { sort: "asc" | "desc" },
): Array<T> {
	if (readings.length === 1) {
		return readings;
	}

	let readingInMemory: T | null = null; // First reading waiting to be processed
	let count = 0;

	let mergedReadings: Array<T> = [];
	for (let i = 0; i < readings.length; i++) {
		if (!readingInMemory) {
			// populate first line
			readingInMemory = readings[i];
			count++;

			continue;
		}

		const currentReading = readings[i];
		const previousReading = readings[i - 1];
		const areSameReadings = compareForMerging(currentReading, previousReading);

		// Last element
		if (i === readings.length - 1) {
			if (areSameReadings) {
				count++;
				const name = buildMergedReadingName(readingInMemory.name, currentReading.name, { sort });
				mergedReadings.push({
					...readingInMemory,
					name: `${name} (${count})`,
					count,
					lastReading: sort === "asc" ? currentReading : readingInMemory,
				});
			} else {
				if (count > 1) {
					const name = buildMergedReadingName(readingInMemory.name, previousReading.name, { sort });
					mergedReadings.push({
						...readingInMemory,
						name: `${name} (${count})`,
						count,
						lastReading: sort === "asc" ? currentReading : readingInMemory,
					});
					mergedReadings.push({ ...currentReading, count: 1 });
				} else {
					mergedReadings.push({ ...readingInMemory, count: 1 });
					mergedReadings.push({ ...currentReading, count: 1 });
				}
			}
			continue;
		}

		// compare
		if (areSameReadings) {
			// same
			count++;
		} else {
			// diff
			if (count === 1) {
				// nothing to merge
				mergedReadings.push({ ...readingInMemory, count });
			} else {
				// merge
				const name = buildMergedReadingName(readingInMemory.name, previousReading.name, { sort });
				mergedReadings.push({
					...readingInMemory,
					name: `${name} (${count})`,
					count,
					lastReading: sort === "asc" ? previousReading : readingInMemory,
				});
			}
			// start another serie
			readingInMemory = currentReading;
			count = 1;
		}
	}
	return mergedReadings;
}

export function getNextReadingName(name: string): string {
	const currentNumber = parseInt(name, 10);
	const nextNumber = isNaN(currentNumber) ? 1 : currentNumber + 1;
	if (currentNumber <= 9) {
		return nextNumber.toString().padStart(2, "0");
	}
	return nextNumber.toString();
}

export function getReadingForQuickAdd(reading: Reading | FrontManga.MergedReading): Reading {
	if ("count" in reading && reading.count !== undefined) {
		if (reading.count > 1 && reading.lastReading) {
			return reading.lastReading;
		}
		// count === 1 (or count <= 1 fallback), return base object minus count/lastReading
		const { count, lastReading, ...rest } = reading;
		return rest;
	}

	// Plain Reading (no count)
	return reading;
}
