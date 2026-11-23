import type { EditionType } from "@personal-tracker/shared/reading-book";

import * as z from "zod";

import type { BookSource, SourceEdition, SourceWork } from "./book-source.provider.js";

import { UpstreamError } from "../../common/errors.js";
import { toIso6391 } from "./language.utils.js";

// Open Library (https://openlibrary.org/developers/api): anonymous JSON. A work is a book, an edition an edition.
const API = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org/b/id";
// no personal details: a generic name for the app
const USER_AGENT = "personal-tracker (book lookup)";
const TIMEOUT_MS = 10_000;
// one call: editions.json gives them all up to its limit (471 for L'Étranger)
const MAX_EDITIONS = 500;
const SEARCH_LIMIT = 10;
const SEARCH_FIELDS = "key,title,author_name,first_publish_year,cover_i";

const SearchDocSchema = z.object({
	key: z.string(),
	title: z.string(),
	author_name: z.array(z.string()).optional(),
	first_publish_year: z.number().int().optional(),
	cover_i: z.number().int().optional(),
});
// each item checked on its own (validItems): one unusual entry doesn't lose the others
const SearchSchema = z.object({ docs: z.array(z.unknown()) });
const EditionSchema = z.object({
	key: z.string(),
	title: z.string().optional(),
	publishers: z.array(z.string()).optional(),
	series: z.array(z.string()).optional(),
	languages: z.array(z.object({ key: z.string() })).optional(),
	number_of_pages: z.number().int().optional(),
	physical_format: z.string().optional(),
	isbn_13: z.array(z.string()).optional(),
	isbn_10: z.array(z.string()).optional(),
	publish_date: z.string().optional(),
	covers: z.array(z.number().int()).optional(),
	works: z.array(z.object({ key: z.string() })).optional(),
});
const EditionsSchema = z.object({ entries: z.array(z.unknown()) });

// the items matching the schema; the others are skipped
function validItems<T>(items: unknown[], schema: z.ZodType<T>) {
	return items.flatMap((item) => {
		const parsed = schema.safeParse(item);
		return parsed.success ? [parsed.data] : [];
	});
}

export class OpenLibraryClient implements BookSource {
	async searchWorks({ title, author }: { title: string; author?: string }) {
		const params = new URLSearchParams({ title, limit: String(SEARCH_LIMIT), fields: SEARCH_FIELDS });
		if (author) {
			params.set("author", author);
		}
		const { docs } = await this.get(`/search.json?${params}`, SearchSchema);
		return validItems(docs, SearchDocSchema).map(toWork);
	}

	async workByIsbn(isbn: string) {
		const workId = (await this.editionByIsbn(isbn))?.workExternalId;
		if (!workId) {
			return null;
		}
		// not /works/{id}.json: its first_publish_date is unreliable (1998 for L'Étranger, 1942 here), and its
		// authors are keys to read one by one
		const params = new URLSearchParams({ q: `key:"/works/${workId}"`, fields: SEARCH_FIELDS });
		const { docs } = await this.get(`/search.json?${params}`, SearchSchema);
		const [work] = validItems(docs, SearchDocSchema);
		return work ? toWork(work) : null;
	}

	async workEditions(workId: string) {
		const { entries } = await this.get(
			`/works/${encodeURIComponent(workId)}/editions.json?limit=${MAX_EDITIONS}`,
			EditionsSchema,
		);
		return validItems(entries, EditionSchema).map(toEdition);
	}

	async editionByIsbn(isbn: string) {
		// redirected to /books/{id}.json; an unknown ISBN answers 404
		const edition = await this.get(`/isbn/${encodeURIComponent(isbn)}.json`, EditionSchema, { orNull: true });
		return edition && toEdition(edition);
	}

	private async get<T>(path: string, schema: z.ZodType<T>, options: { orNull: true }): Promise<T | null>;
	private async get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
	private async get<T>(path: string, schema: z.ZodType<T>, { orNull = false } = {}): Promise<T | null> {
		let response: Response;
		try {
			response = await fetch(`${API}${path}`, {
				headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
		} catch (error) {
			throw new UpstreamError("upstream_unavailable", `openLibrary unreachable: ${String(error)}`, {
				service: "openLibrary",
			});
		}
		if (orNull && response.status === 404) {
			return null;
		}
		if (!response.ok) {
			throw new UpstreamError("upstream_unavailable", `openLibrary answered ${response.status}`, {
				service: "openLibrary",
				status: response.status,
			});
		}
		const parsed = schema.safeParse(await response.json().catch(() => undefined));
		if (!parsed.success) {
			throw new UpstreamError("upstream_unavailable", `openLibrary answered an unexpected body for ${path}`, {
				service: "openLibrary",
				// it answered: not unreachable
				reason: "unexpected_body",
			});
		}
		return parsed.data;
	}
}

// "/works/OL1230613W" → "OL1230613W"
const bareId = (key: string) => key.slice(key.lastIndexOf("/") + 1);
// the first 4-digit number: "1984", "Mar 04, 2011", "2019-8-1"
const yearOf = (date?: string) => {
	const year = date?.match(/\b\d{4}\b/)?.[0];
	return year ? Number(year) : null;
};
// -1 stands for a removed cover
const coverUrl = (ids: number[] | undefined, size: "M" | "L") => {
	const id = ids?.find((cover) => cover > 0);
	return id ? `${COVERS}/${id}-${size}.jpg` : null;
};

function toWork(doc: z.infer<typeof SearchDocSchema>): SourceWork {
	return {
		source: "openLibrary",
		externalId: bareId(doc.key),
		title: doc.title,
		authors: doc.author_name ?? [],
		originalYear: doc.first_publish_year ?? null,
		cover: coverUrl(doc.cover_i ? [doc.cover_i] : undefined, "M"),
	};
}

function toEdition(edition: z.infer<typeof EditionSchema>): SourceEdition {
	const language = edition.languages?.[0]?.key;
	return {
		source: "openLibrary",
		externalId: bareId(edition.key),
		workExternalId: edition.works?.[0] ? bareId(edition.works[0].key) : null,
		title: edition.title ?? null,
		publisher: edition.publishers?.[0] ?? null,
		collection: edition.series?.[0] ?? null,
		language: language ? toIso6391(bareId(language)) : null,
		pages: edition.number_of_pages ?? null,
		type: editionType(edition.physical_format),
		isbn: edition.isbn_13?.[0] ?? edition.isbn_10?.[0] ?? null,
		year: yearOf(edition.publish_date),
		cover: coverUrl(edition.covers, "L"),
	};
}

// Free text ("Paperback", "Ebook", "[electronic resource] /", "Audio CD"…): an audio book or an unknown binding
// is neither a print nor a digital edition
export function editionType(format?: string): EditionType | null {
	const text = format?.toLowerCase() ?? "";
	if (!text || /audio|cassette|\bcd\b|mp3|unknown/.test(text)) {
		return null;
	}
	if (/e-?book|electronic|digital|kindle|epub/.test(text)) {
		return "digital";
	}
	return "print";
}
