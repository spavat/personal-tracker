import { describe, expect, it, vi } from "vitest";

import type { EntitiesRepository } from "../../entities/entities.repository.js";
import type { BookSource, SourceEdition, SourceWork } from "./book-source.provider.js";

import { NotFoundError } from "../../common/errors.js";
import { BookLookupService } from "./book-lookup.service.js";

const work = (fields: Partial<SourceWork> = {}): SourceWork => ({
	source: "openLibrary",
	externalId: "OL1230613W",
	title: "L’étranger",
	authors: ["Albert Camus"],
	originalYear: 1942,
	cover: null,
	...fields,
});
const edition = (fields: Partial<SourceEdition> = {}): SourceEdition => ({
	source: "openLibrary",
	externalId: "OL59879604M",
	workExternalId: "OL1230613W",
	title: "L’étranger",
	publisher: "Gallimard",
	collection: null,
	language: "fr",
	pages: 185,
	type: "print",
	isbn: "2070360024",
	year: 1984,
	cover: null,
	...fields,
});

function build(entities: Array<{ id: string; names: string[] }> = []) {
	const source = {
		searchWorks: vi.fn().mockResolvedValue([]),
		workByIsbn: vi.fn().mockResolvedValue(null),
		workEditions: vi.fn().mockResolvedValue([]),
		editionByIsbn: vi.fn().mockResolvedValue(null),
	} satisfies BookSource;
	const repo = { findByNames: vi.fn().mockResolvedValue(entities) };
	const service = new BookLookupService({ openLibrary: source }, repo as unknown as EntitiesRepository);
	return { service, source, repo };
}

describe("BookLookupService.searchWorks", () => {
	it("gives each author the entity of that name, when it is the only one", async () => {
		const { service, source, repo } = build([
			{ id: "camus", names: ["Albert Camus"] },
			{ id: "dupont-1", names: ["Jean Dupont"] },
			{ id: "dupont-2", names: ["Jean Dupont"] },
		]);
		source.searchWorks.mockResolvedValue([
			work({ authors: ["Albert Camus", "Jean Dupont", "Inconnu"] }),
			work({ externalId: "OL2W", authors: ["Albert Camus"] }),
		]);

		const works = await service.searchWorks("openLibrary", { title: "l'étranger" });

		// each name once
		expect(repo.findByNames).toHaveBeenCalledWith(["Albert Camus", "Jean Dupont", "Inconnu"], "person");
		expect(works[0].authors).toEqual([
			{ name: "Albert Camus", entityId: "camus" },
			// two entities of that name: none chosen
			{ name: "Jean Dupont", entityId: null },
			{ name: "Inconnu", entityId: null },
		]);
		expect(works[1].authors).toEqual([{ name: "Albert Camus", entityId: "camus" }]);
	});

	it("by ISBN: the work of that edition, or none", async () => {
		const { service, source } = build();
		source.workByIsbn.mockResolvedValueOnce(work());

		expect(await service.searchWorks("openLibrary", { isbn: "2070360024" })).toHaveLength(1);
		expect(source.workByIsbn).toHaveBeenCalledWith("2070360024");
		expect(source.searchWorks).not.toHaveBeenCalled();
		expect(await service.searchWorks("openLibrary", { isbn: "9799999999990" })).toEqual([]);
	});

	it("gives the entity to every spelling of its name", async () => {
		const { service, source } = build([{ id: "zola", names: ["Émile Zola", "Emile Zola"] }]);
		source.searchWorks.mockResolvedValue([work({ authors: ["Émile Zola"] }), work({ authors: ["Emile Zola"] })]);

		const works = await service.searchWorks("openLibrary", { title: "Nana" });

		expect(works.map(({ authors }) => authors[0].entityId)).toEqual(["zola", "zola"]);
	});
});

describe("BookLookupService.workEditions", () => {
	it("keeps the editions in the language asked, and the ones without a language", async () => {
		const { service, source } = build();
		source.workEditions.mockResolvedValue([
			edition({ externalId: "fr" }),
			edition({ externalId: "en", language: "en" }),
			edition({ externalId: "none", language: null }),
		]);

		const editions = await service.workEditions("openLibrary", "OL1230613W", "fr");

		expect(editions.map(({ externalId }) => externalId)).toEqual(["fr", "none"]);
		expect((await service.workEditions("openLibrary", "OL1230613W")).length).toBe(3);
	});

	it("matches the publishers to the organizations", async () => {
		const { service, source, repo } = build([{ id: "gallimard", names: ["Gallimard"] }]);
		source.workEditions.mockResolvedValue([edition(), edition({ publisher: null })]);

		const editions = await service.workEditions("openLibrary", "OL1230613W");

		expect(repo.findByNames).toHaveBeenCalledWith(["Gallimard"], "organization");
		expect(editions.map(({ publisher }) => publisher)).toEqual([
			{ name: "Gallimard", entityId: "gallimard" },
			null,
		]);
	});
});

describe("BookLookupService.editionByIsbn", () => {
	it("throws a NotFoundError for an unknown ISBN", async () => {
		const { service } = build();

		await expect(service.editionByIsbn("openLibrary", "9799999999990")).rejects.toBeInstanceOf(NotFoundError);
	});
});
