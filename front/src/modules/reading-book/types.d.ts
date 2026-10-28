import { ReadingContextItem } from "@personal-tracker/shared/reading-book";

namespace FrontReading {
	interface ContextItem {
		date: string;
		tags: Array<string>;
	}

	interface ReadTitle {
		id: string;
		title: string;
		content: Array<ReadChapter | ReadTitle>;
	}

	interface ReadChapter {
		id: string;
		chapter: string;
	}

	interface ReadStats {
		id: string;
		chapter: string;
		tags: any[];
	}

	interface ReadDetails {
		id: string;
		context: Array<ContextItem>;
	}

	interface Reading {
		id: string;
		status: "complete" | "abandoned" | "in-progress";
		details: Array<ReadDetails>;
	}

	interface Book {
		book: string;
		author: Array<string>;
		language: string;
		country: string;
		pages: number;
		complete: boolean;
		modele: Array<ReadChapter | ReadTitle>;
		readings: Array<Reading>;
	}

	interface MainTag {
		name: string;
		tags: Array<string>;
	}

	// ------ LOCAL for BOOK
	type MapReadingContext = Map<string, Array<ReadingContextItem>>;
}
