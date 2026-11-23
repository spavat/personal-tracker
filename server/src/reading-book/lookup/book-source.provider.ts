import type { Provider } from "@nestjs/common";
import type { LookupEdition, LookupSource, LookupWork } from "@personal-tracker/shared/reading-book";

import { OpenLibraryClient } from "./openlibrary.client.js";

// What a source gives: the names, not matched to the entities yet
export type SourceWork = Omit<LookupWork, "authors"> & { authors: string[] };
export type SourceEdition = Omit<LookupEdition, "publisher"> & { publisher: string | null };

// An outside source of books and editions. A new source is one more client here.
export interface BookSource {
	searchWorks(query: { title: string; author?: string }): Promise<SourceWork[]>;
	// null: unknown ISBN
	workByIsbn(isbn: string): Promise<SourceWork | null>;
	workEditions(workId: string): Promise<SourceEdition[]>;
	// null: unknown ISBN
	editionByIsbn(isbn: string): Promise<SourceEdition | null>;
}

export const BOOK_SOURCES = Symbol("BOOK_SOURCES");
export type BookSources = Record<LookupSource, BookSource>;

export const bookSourcesProvider: Provider = {
	provide: BOOK_SOURCES,
	useFactory: (): BookSources => ({ openLibrary: new OpenLibraryClient() }),
};
