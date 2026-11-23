import type { EntityKind } from "@personal-tracker/shared/entity";
import type { LookupEdition, LookupSource, LookupWork, LookupWorksQuery } from "@personal-tracker/shared/reading-book";

import { Inject, Injectable, Logger } from "@nestjs/common";

import { NotFoundError } from "../../common/errors.js";
import { EntitiesRepository } from "../../entities/entities.repository.js";
import { BOOK_SOURCES, type BookSources, type SourceEdition, type SourceWork } from "./book-source.provider.js";

// Books and editions found in an outside source, their people and publishers matched to the entities
@Injectable()
export class BookLookupService {
	private readonly logger = new Logger(BookLookupService.name);

	constructor(
		@Inject(BOOK_SOURCES) private readonly sources: BookSources,
		private readonly entities: EntitiesRepository,
	) {}

	// by ISBN: the work of that edition (none when the ISBN is unknown)
	async searchWorks(source: LookupSource, query: LookupWorksQuery): Promise<LookupWork[]> {
		this.logger.log("searchWorks");
		let works: SourceWork[];
		if ("isbn" in query) {
			const work = await this.sources[source].workByIsbn(query.isbn);
			works = work ? [work] : [];
		} else {
			works = await this.sources[source].searchWorks(query);
		}
		const entityIds = await this.matchEntities(
			works.flatMap(({ authors }) => authors),
			"person",
		);
		return works.map((work) => ({
			...work,
			authors: work.authors.map((name) => ({ name, entityId: entityIds.get(name) ?? null })),
		}));
	}

	// in this language: an edition without a language is kept
	async workEditions(source: LookupSource, workId: string, language?: string) {
		this.logger.log("workEditions");
		const editions = (await this.sources[source].workEditions(workId)).filter(
			(edition) => !language || !edition.language || edition.language === language,
		);
		return this.withPublishers(editions);
	}

	async editionByIsbn(source: LookupSource, isbn: string) {
		this.logger.log("editionByIsbn");
		const edition = await this.sources[source].editionByIsbn(isbn);
		if (!edition) {
			throw new NotFoundError("edition");
		}
		const [found] = await this.withPublishers([edition]);
		return found;
	}

	private async withPublishers(editions: SourceEdition[]): Promise<LookupEdition[]> {
		const entityIds = await this.matchEntities(
			editions.flatMap(({ publisher }) => (publisher ? [publisher] : [])),
			"organization",
		);
		return editions.map(({ publisher, ...edition }) => ({
			...edition,
			publisher: publisher ? { name: publisher, entityId: entityIds.get(publisher) ?? null } : null,
		}));
	}

	// name → the entity of that name, when it is the only one
	private async matchEntities(names: string[], kind: EntityKind) {
		const matches = await this.entities.findByNames([...new Set(names)], kind);
		const idsByName = Map.groupBy(
			matches.flatMap(({ id, names: matched }) => matched.map((name) => ({ id, name }))),
			({ name }) => name,
		);
		return new Map(
			[...idsByName].flatMap(([name, entities]) => (entities.length === 1 ? [[name, entities[0].id]] : [])),
		);
	}
}
