import { MangaOverview, Reading } from "@personal-tracker/shared/reading-manga";

namespace FrontManga {
	interface ExtendedManga extends MangaOverview {
		mergedReadings: Array<Reading>;
	}

	interface MergedReading extends Reading {
		count?: number;
		lastReading?: Reading;
	}
}
