import { afterEach, describe, expect, it, vi } from "vitest";

import { UpstreamError } from "../../common/errors.js";
import { editionType, OpenLibraryClient } from "./openlibrary.client.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

// trimmed from real answers (.scratch/reading-book-openlibrary/samples)
const SEARCH_ETRANGER = {
	numFound: 3,
	docs: [
		{
			author_name: ["Albert Camus"],
			cover_i: 13151269,
			first_publish_year: 1942,
			key: "/works/OL1230613W",
			title: "L’étranger",
		},
		{
			author_name: ["Albert Camus"],
			first_publish_year: 1979,
			key: "/works/OL1230686W",
			title: "L'étranger, suivi de Noces, de L'été, et de L'envers et l'endroit",
		},
	],
};
const FOLIO = {
	works: [{ key: "/works/OL1230613W" }],
	title: "L’étranger",
	publishers: ["Gallimard"],
	publish_date: "1984",
	key: "/books/OL59879604M",
	covers: [15166217, 15115103],
	isbn_10: ["2070360024"],
	series: ["Collection Folio No. 2"],
	languages: [{ key: "/languages/fre" }],
	physical_format: "Paperback",
	number_of_pages: 185,
};
const EDITIONS = {
	links: { self: "/works/OL1230613W/editions.json?limit=500", work: "/works/OL1230613W" },
	size: 3,
	entries: [
		{
			key: "/books/OL62721338M",
			title: "Der Fremde",
			publishers: ["Rowohlt"],
			languages: [{ key: "/languages/ger" }],
			number_of_pages: 153,
			physical_format: "Taschenbuch",
			publish_date: "1961-07",
			covers: [15273688],
			works: [{ key: "/works/OL1230613W" }],
			series: ["rororo 432"],
		},
		{
			key: "/books/OL53421270M",
			title: "L'étranger",
			publishers: ["ARTFL Project"],
			languages: [{ key: "/languages/fre" }],
			physical_format: "[electronic resource] /",
			publish_date: "1984",
			works: [{ key: "/works/OL1230613W" }],
		},
		{
			key: "/books/OL43718678M",
			title: "The Stranger",
			publishers: ["CreateSpace Independent Publishing Platform"],
			number_of_pages: 100,
			isbn_13: ["9781534663329"],
			isbn_10: ["1534663320"],
			publish_date: "Mar 04, 2016",
			covers: [-1],
			works: [{ key: "/works/OL1230613W" }],
		},
	],
};

function stubFetch(...responses: Response[]) {
	const fetch = vi.fn();
	for (const response of responses) {
		fetch.mockResolvedValueOnce(response);
	}
	vi.stubGlobal("fetch", fetch);
	return fetch;
}
const calledUrl = (fetch: ReturnType<typeof vi.fn>, call = 0) => new URL(fetch.mock.calls[call][0]);

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("OpenLibraryClient.searchWorks", () => {
	it("searches by title and author, and gives the works with their authors, year and cover", async () => {
		const fetch = stubFetch(json(SEARCH_ETRANGER));

		const works = await new OpenLibraryClient().searchWorks({ title: "l'étranger", author: "camus" });

		const url = calledUrl(fetch);
		expect(url.pathname).toBe("/search.json");
		expect(url.searchParams.get("title")).toBe("l'étranger");
		expect(url.searchParams.get("author")).toBe("camus");
		expect(fetch.mock.calls[0][1].headers["User-Agent"]).toBe("personal-tracker (book lookup)");
		expect(works).toEqual([
			{
				source: "openLibrary",
				externalId: "OL1230613W",
				title: "L’étranger",
				authors: ["Albert Camus"],
				originalYear: 1942,
				cover: "https://covers.openlibrary.org/b/id/13151269-M.jpg",
			},
			{
				source: "openLibrary",
				externalId: "OL1230686W",
				title: "L'étranger, suivi de Noces, de L'été, et de L'envers et l'endroit",
				authors: ["Albert Camus"],
				originalYear: 1979,
				cover: null,
			},
		]);
	});

	it("leaves the author out of the query when none is given", async () => {
		const fetch = stubFetch(json({ docs: [] }));

		await new OpenLibraryClient().searchWorks({ title: "Dune" });

		expect(calledUrl(fetch).searchParams.has("author")).toBe(false);
	});

	it("throws an UpstreamError when Open Library fails", async () => {
		stubFetch(json({}, 503));

		await expect(new OpenLibraryClient().searchWorks({ title: "Dune" })).rejects.toMatchObject({
			code: "upstream_unavailable",
			params: { service: "openLibrary", status: 503 },
		});
	});

	it("throws an UpstreamError when Open Library can't be reached", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

		await expect(new OpenLibraryClient().searchWorks({ title: "Dune" })).rejects.toBeInstanceOf(UpstreamError);
	});

	it("skips a result it can't read, keeping the others", async () => {
		stubFetch(json({ docs: [{ title: "no key" }, SEARCH_ETRANGER.docs[0]] }));

		const works = await new OpenLibraryClient().searchWorks({ title: "Dune" });

		expect(works.map(({ externalId }) => externalId)).toEqual(["OL1230613W"]);
	});

	it("throws an UpstreamError on an unexpected body", async () => {
		stubFetch(new Response("<html>maintenance</html>"));

		await expect(new OpenLibraryClient().searchWorks({ title: "Dune" })).rejects.toMatchObject({
			code: "upstream_unavailable",
			params: { service: "openLibrary", reason: "unexpected_body" },
		});
	});
});

describe("OpenLibraryClient.editionByIsbn", () => {
	it("maps the edition: bare ids, ISO 639-1 language, type, year and large cover", async () => {
		const fetch = stubFetch(json(FOLIO));

		const edition = await new OpenLibraryClient().editionByIsbn("2070360024");

		expect(calledUrl(fetch).pathname).toBe("/isbn/2070360024.json");
		expect(edition).toEqual({
			source: "openLibrary",
			externalId: "OL59879604M",
			workExternalId: "OL1230613W",
			title: "L’étranger",
			publisher: "Gallimard",
			collection: "Collection Folio No. 2",
			language: "fr",
			pages: 185,
			type: "print",
			isbn: "2070360024",
			year: 1984,
			cover: "https://covers.openlibrary.org/b/id/15166217-L.jpg",
		});
	});

	it("gives null for an unknown ISBN (404)", async () => {
		stubFetch(new Response("<html>Not found</html>", { status: 404 }));

		expect(await new OpenLibraryClient().editionByIsbn("9799999999990")).toBeNull();
	});
});

describe("OpenLibraryClient.workByIsbn", () => {
	it("gives the work of the edition, read from the search by its key", async () => {
		const fetch = stubFetch(json(FOLIO), json({ docs: [SEARCH_ETRANGER.docs[0]] }));

		const work = await new OpenLibraryClient().workByIsbn("2070360024");

		expect(calledUrl(fetch, 1).searchParams.get("q")).toBe('key:"/works/OL1230613W"');
		expect(work).toMatchObject({ externalId: "OL1230613W", originalYear: 1942, authors: ["Albert Camus"] });
	});

	it("gives null for an unknown ISBN", async () => {
		const fetch = stubFetch(new Response("", { status: 404 }));

		expect(await new OpenLibraryClient().workByIsbn("9799999999990")).toBeNull();
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});

describe("OpenLibraryClient.workEditions", () => {
	it("reads all the editions in one call, ISBN-13 first, a removed cover (-1) as none", async () => {
		const fetch = stubFetch(json(EDITIONS));

		const editions = await new OpenLibraryClient().workEditions("OL1230613W");

		const url = calledUrl(fetch);
		expect(url.pathname).toBe("/works/OL1230613W/editions.json");
		expect(url.searchParams.get("limit")).toBe("500");
		expect(
			editions.map(({ language, type, year, isbn, cover, collection }) => ({
				language,
				type,
				year,
				isbn,
				cover,
				collection,
			})),
		).toEqual([
			{
				language: "de",
				type: "print",
				year: 1961,
				isbn: null,
				cover: "https://covers.openlibrary.org/b/id/15273688-L.jpg",
				collection: "rororo 432",
			},
			{ language: "fr", type: "digital", year: 1984, isbn: null, cover: null, collection: null },
			{ language: null, type: null, year: 2016, isbn: "9781534663329", cover: null, collection: null },
		]);
	});
});

describe("OpenLibraryClient.workEditions with an unusual edition", () => {
	it("skips it, keeping the others", async () => {
		const unusual = { ...EDITIONS.entries[0], key: "/books/OL9M", number_of_pages: 153.5, series: [{ name: "x" }] };
		stubFetch(json({ entries: [unusual, ...EDITIONS.entries] }));

		const editions = await new OpenLibraryClient().workEditions("OL1230613W");

		expect(editions).toHaveLength(3);
		expect(editions.map(({ externalId }) => externalId)).not.toContain("OL9M");
	});
});

describe("editionType", () => {
	it.each([
		["Paperback", "print"],
		["hardcover", "print"],
		["Taschenbuch", "print"],
		["Ebook", "digital"],
		["[electronic resource] /", "digital"],
		["Audio CD", null],
		["preloaded digital audio player", null],
		["Audio Cassette", null],
		["mp3 cd", null],
		["unknown binding", null],
		[undefined, null],
	])("%s → %s", (format, type) => {
		expect(editionType(format)).toBe(type);
	});
});
