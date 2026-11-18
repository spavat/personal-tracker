import type {
	BookListRequestSchema,
	GetReportResponse,
	SaveBookRequestSchema,
	SaveBookModelRequest,
	SaveEditionRequest,
	SaveReadingRequestSchema,
	SaveSeriesRequest,
	SeriesDetails,
	AuthorDetails,
} from "@personal-tracker/shared/reading-book";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import { httpErrors } from "@fastify/sensible";
import { randomUUID } from "crypto";

import type { EntityKind } from "../../db/node";
import type { ContextTagRepository } from "../context-tags/context-tag.repository";
import type { BookRepository } from "./book.repository";
import type { CoverStorageRepository } from "./cover-storage.repository";

import { toEntityView } from "../entities/entity.entity";
import { buildInitialReading, getLongestConsecutiveStreak, median } from "./book.entity";
import { buildSeriesTree, createsCycle, parentsOf, treeBookIds } from "./series.entity";

type BookListQuery = z.infer<typeof BookListRequestSchema>;
type SaveBookBody = z.infer<typeof SaveBookRequestSchema>;
type SaveReadingBody = z.infer<typeof SaveReadingRequestSchema>;

function isDateBetween(dateStr: string, fromStr: string, toStr: string) {
	return dateStr >= fromStr && dateStr <= toStr;
}

export class ListBooksUseCase {
	constructor(private repo: BookRepository) {}

	execute({ sort, from, to, withReadingsDetails }: BookListQuery, log: FastifyBaseLogger) {
		log.info("ListBooksUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["lastReadDate", "desc"];
		return this.repo.findAll({ from, to, withReadingsDetails, sortField, sortDirection });
	}
}

export class GetBookUseCase {
	constructor(private repo: BookRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("GetBookUseCase.execute");
		return this.repo.findById(id);
	}
}

export class SaveBookUseCase {
	constructor(private repo: BookRepository) {}

	async execute(book: SaveBookBody, log: FastifyBaseLogger) {
		log.info("SaveBookUseCase.execute");
		await assertEntities(
			this.repo,
			book.authors.map(({ entityId }) => entityId),
			["person"],
		);
		let bookId = book.id;
		if (bookId) {
			await this.repo.update(bookId, book);
		} else {
			bookId = randomUUID();
			await this.repo.insert(bookId, book);
		}
		return this.repo.findById(bookId);
	}
}

// The credited entities must exist, with the kind the credit expects
async function assertEntities(repo: BookRepository, ids: string[], kinds: EntityKind[]) {
	if ((await repo.countEntities(ids, kinds)) !== new Set(ids).size) {
		throw httpErrors.badRequest(kinds.includes("organization") ? "Organisation inconnue" : "Personne inconnue");
	}
}

export class ListAuthorsUseCase {
	constructor(private repo: BookRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("ListAuthorsUseCase.execute");
		return (await this.repo.findAuthors()).map(toEntityView);
	}
}

export class GetAuthorUseCase {
	constructor(private repo: BookRepository) {}

	async execute(id: string, log: FastifyBaseLogger): Promise<AuthorDetails | undefined> {
		log.info("GetAuthorUseCase.execute");
		const author = await this.repo.findEntity(id);
		if (!author) {
			return undefined;
		}
		// in publication order
		const books = await this.repo.findAll({
			withReadingsDetails: false,
			authorId: id,
			sortField: "originalYear",
			sortDirection: "asc",
		});
		return { ...toEntityView(author), books };
	}
}

export class ListSeriesUseCase {
	constructor(private repo: BookRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("ListSeriesUseCase.execute");
		const [series, items] = await Promise.all([this.repo.findAllSeries(), this.repo.findAllSeriesItems()]);
		const seriesById = new Map(series.map((item) => [item.id, item]));
		return series.map(({ id, title }) => ({
			id,
			title,
			nbBooks: treeBookIds(id, items).length,
			parents: parentsOf(id, items, seriesById),
		}));
	}
}

export class GetSeriesUseCase {
	constructor(private repo: BookRepository) {}

	async execute(id: string, log: FastifyBaseLogger): Promise<SeriesDetails | undefined> {
		log.info("GetSeriesUseCase.execute");
		const series = await this.repo.findSeries(id);
		if (!series) {
			return undefined;
		}
		const [allSeries, items] = await Promise.all([this.repo.findAllSeries(), this.repo.findAllSeriesItems()]);
		const seriesById = new Map(allSeries.map((item) => [item.id, item]));
		const bookIds = treeBookIds(id, items);
		const books = bookIds.length ? await this.repo.findAll({ withReadingsDetails: false, bookIds }) : [];
		return {
			...series,
			parents: parentsOf(id, items, seriesById),
			items: buildSeriesTree(id, items, seriesById, new Map(books.map((book) => [book.id, book]))),
		};
	}
}

export class SaveSeriesUseCase {
	constructor(private repo: BookRepository) {}

	async execute(series: SaveSeriesRequest, log: FastifyBaseLogger) {
		log.info("SaveSeriesUseCase.execute");
		const bookIds = series.items.flatMap((item) => (item.kind === "book" ? [item.bookId] : []));
		const childIds = series.items.flatMap((item) => (item.kind === "series" ? [item.seriesId] : []));
		if (new Set(bookIds).size !== bookIds.length || new Set(childIds).size !== childIds.length) {
			throw httpErrors.badRequest("Un livre ou une série n'est qu'une fois dans une série");
		}
		if ((await this.repo.countBooks(bookIds)) !== bookIds.length) {
			throw httpErrors.badRequest("Livre inconnu");
		}
		if ((await this.repo.countSeries(childIds)) !== childIds.length) {
			throw httpErrors.badRequest("Série inconnue");
		}
		// a new series is held by none: it can't be in its own tree
		if (series.id && createsCycle(series.id, childIds, await this.repo.findAllSeriesItems())) {
			throw httpErrors.badRequest("Une série ne peut pas se contenir elle-même, même par une sous-série");
		}
		const id = await this.repo.saveSeries(series);
		if (!id) {
			throw httpErrors.notFound("Série introuvable");
		}
		return { id };
	}
}

export class DeleteSeriesUseCase {
	constructor(private repo: BookRepository) {}

	async execute(id: string, log: FastifyBaseLogger) {
		log.info("DeleteSeriesUseCase.execute");
		if (!(await this.repo.findSeries(id))) {
			throw httpErrors.notFound("Série introuvable");
		}
		await this.repo.deleteSeries(id);
	}
}

export class SaveModelUseCase {
	constructor(private repo: BookRepository) {}

	async execute({ bookId, model }: { bookId: string; model: SaveBookModelRequest }, log: FastifyBaseLogger) {
		log.info("SaveModelUseCase.execute");
		if (!(await this.repo.saveModel(bookId, model))) {
			throw httpErrors.notFound(model.id ? "Modèle introuvable" : "Livre introuvable");
		}
	}
}

export class DeleteModelUseCase {
	constructor(private repo: BookRepository) {}

	async execute({ bookId, modelId }: { bookId: string; modelId: string }, log: FastifyBaseLogger) {
		log.info("DeleteModelUseCase.execute");
		const model = await this.repo.findModel(bookId, modelId);
		if (!model) {
			throw httpErrors.notFound("Modèle introuvable");
		}
		// their readings point to its chapters
		if (model.nbReadEditions > 0) {
			throw httpErrors.conflict("Ce modèle est utilisé par une édition qui a des lectures");
		}
		await this.repo.deleteModel(bookId, modelId);
	}
}

export class AddReadingUseCase {
	constructor(private repo: BookRepository) {}

	async execute({ bookId, editionId }: { bookId: string; editionId: string }, log: FastifyBaseLogger) {
		log.info("AddReadingUseCase.execute");
		if (!(await this.repo.pushReading(bookId, editionId, buildInitialReading()))) {
			throw httpErrors.notFound("Édition introuvable");
		}
	}
}

export class SaveEditionUseCase {
	constructor(
		private repo: BookRepository,
		private covers: CoverStorageRepository,
	) {}

	async execute({ bookId, edition }: { bookId: string; edition: SaveEditionRequest }, log: FastifyBaseLogger) {
		log.info("SaveEditionUseCase.execute");
		const current = edition.id ? await this.repo.findEdition(bookId, edition.id) : undefined;
		if (edition.id && !current) {
			throw httpErrors.notFound("Édition introuvable");
		}
		await assertEntities(this.repo, edition.publisherId ? [edition.publisherId] : [], ["organization"]);
		await assertEntities(
			this.repo,
			edition.translators.map(({ entityId }) => entityId),
			["person"],
		);
		if (edition.modelId && !(await this.repo.findModel(bookId, edition.modelId))) {
			throw httpErrors.badRequest("Ce modèle n'est pas un modèle du livre");
		}
		// the entries of its readings point to the chapters of its model
		if (current && current.nbReadings > 0 && current.modelId !== edition.modelId) {
			throw httpErrors.conflict("Le modèle d'une édition qui a des lectures ne peut pas changer");
		}
		const id = edition.id ?? randomUUID();
		const { cover, ...fields } = edition;

		// the URL given by the server = unchanged, another source = new cover, empty = no cover
		let coverKey = current?.coverKey ?? null;
		if (!cover) {
			coverKey = null;
		} else if (!this.covers.isOwnUrl(cover)) {
			coverKey = await this.covers.upload(id, cover);
		}

		const saved = await this.repo.saveEdition(bookId, !edition.id, { ...fields, id, coverKey });
		if (!saved) {
			// the cover just uploaded is of no use
			if (coverKey && coverKey !== current?.coverKey) {
				await deleteCover(this.covers, coverKey, log);
			}
			throw httpErrors.notFound("Livre introuvable");
		}
		// the former cover was replaced or removed
		if (current?.coverKey && current.coverKey !== coverKey) {
			await deleteCover(this.covers, current.coverKey, log);
		}
	}
}

// A cover left behind in S3 is harmless: its deletion never fails the request
async function deleteCover(covers: CoverStorageRepository, key: string, log: FastifyBaseLogger) {
	try {
		await covers.deleteObject(key);
	} catch (error) {
		log.warn({ error, key }, "cover not deleted");
	}
}

export class DeleteEditionUseCase {
	constructor(
		private repo: BookRepository,
		private covers: CoverStorageRepository,
	) {}

	async execute({ bookId, editionId }: { bookId: string; editionId: string }, log: FastifyBaseLogger) {
		log.info("DeleteEditionUseCase.execute");
		const edition = await this.repo.findEdition(bookId, editionId);
		if (!edition) {
			throw httpErrors.notFound("Édition introuvable");
		}
		if (edition.nbReadings > 0) {
			throw httpErrors.conflict("Cette édition a des lectures : supprimez-les d'abord");
		}
		if (edition.nbBookEditions <= 1) {
			throw httpErrors.conflict("Un livre garde au moins une édition");
		}
		await this.repo.deleteEdition(bookId, editionId);
		if (edition.coverKey) {
			await deleteCover(this.covers, edition.coverKey, log);
		}
	}
}

export class SaveReadingUseCase {
	constructor(private repo: BookRepository) {}

	execute({ bookId, reading }: { bookId: string; reading: SaveReadingBody }, log: FastifyBaseLogger) {
		log.info("SaveReadingUseCase.execute");
		if (!bookId) {
			throw new Error("Book ID is required");
		}
		return this.repo.updateReading(bookId, reading);
	}
}

export class DeleteReadingUseCase {
	constructor(private repo: BookRepository) {}

	execute({ bookId, readingId }: { bookId: string; readingId: string }, log: FastifyBaseLogger) {
		log.info("DeleteReadingUseCase.execute");
		if (!readingId) {
			throw new Error("Reading ID is required");
		}
		return this.repo.deleteReading(bookId, readingId);
	}
}

export class GetReportUseCase {
	constructor(
		private repo: BookRepository,
		private contextTagRepo: ContextTagRepository,
	) {}

	async execute({ from, to }: { from: string; to: string }, log: FastifyBaseLogger): Promise<GetReportResponse> {
		log.info("GetReportUseCase.execute");
		const books = await this.repo.findAll({
			from,
			to,
			withReadingsDetails: true,
			sortField: "name",
			sortDirection: "asc",
		});

		const contextTagGroups = (await this.contextTagRepo.findAll()) ?? [];
		const mapTags: Record<string, string> = {};
		for (const group of contextTagGroups) {
			for (const tag of group.tags) {
				mapTags[tag] = group.name;
			}
		}

		let totalChapters = 0;
		const allDates = new Set<string>();
		const statusDistribution: Record<string, any> = {};
		const tagDistribution: Record<string, number> = {};
		const langDistribution: Record<string, number> = {};
		const authorDistribution: Record<string, any> = {};
		for (let book of books ?? []) {
			const authors = book.authors.map(({ name }) => name);
			for (let reading of book.readings) {
				// Status distribution
				const status =
					reading.status === "complete" && !isDateBetween(reading.lastReadDate, from, to)
						? "in-progress" // Completed after the selected period, considered in-progress
						: reading.status;
				if (!statusDistribution[status]) {
					statusDistribution[status] = [];
				}
				statusDistribution[status].push(reading.readingDates.length);

				authors.forEach((author) => {
					if (!authorDistribution[author]) {
						authorDistribution[author] = {
							books: 0,
							chapters: 0,
							differentDays: new Set(),
						};
					}
					if (status === "complete") {
						authorDistribution[author].books++;
					}
				});

				// always loaded: the report asks for withReadingsDetails
				for (let detail of reading.details ?? []) {
					const dates: Array<string> = [];
					dates.push(...detail.context.map(({ date }: { date: string }) => date));
					const datesThisYear = dates.filter((date) => isDateBetween(date, from, to));
					if (datesThisYear.length) {
						totalChapters++;
						for (let date of datesThisYear) {
							allDates.add(date);
						}

						// Group by tag (each tag group counts once per chapter)
						const chapterTags = new Set<string>();
						detail.context.forEach(({ tags }: { tags: Array<string> }) => {
							tags.forEach((tag) => {
								chapterTags.add(mapTags[tag] ?? tag);
							});
						});
						chapterTags.forEach((mainTag) => {
							if (!tagDistribution[mainTag]) {
								tagDistribution[mainTag] = 0;
							}
							tagDistribution[mainTag]++;
						});

						// Group by language (of the reading's edition)
						if (!langDistribution[reading.language]) {
							langDistribution[reading.language] = 0;
						}
						langDistribution[reading.language]++;

						// Group by author
						authors.forEach((author) => {
							authorDistribution[author].chapters++;
							datesThisYear.forEach((date) => {
								authorDistribution[author].differentDays.add(date);
							});
						});
					}
				}
			}
		}

		const streakInfo = getLongestConsecutiveStreak(Array.from(allDates));

		return {
			hasData: Array.isArray(books) && books.length > 0,
			streakInfo,
			statusDistribution: Object.entries(statusDistribution)
				.map(([key, values]) => ({
					name: key,
					books: values.length,
					averageDays: Math.round(
						values.reduce((acc: number, number: number) => acc + number, 0) / values.length,
					),
					medianDays: median(values),
				}))
				.toSorted((a, b) => b.books - a.books),
			tagDistribution: Object.entries(tagDistribution)
				.map(([key, count]) => ({
					name: key,
					chapters: count,
					percent: Math.round((count / totalChapters) * 100),
				}))
				.toSorted((a, b) => b.chapters - a.chapters),
			langDistribution: Object.entries(langDistribution)
				.map(([key, count]) => ({
					name: key,
					chapters: count,
					percent: Math.round((count / totalChapters) * 100),
				}))
				.toSorted((a, b) => b.chapters - a.chapters),
			authorDistribution: Object.entries(authorDistribution)
				.map(([key, values]) => ({
					name: key,
					books: values.books,
					chapters: values.chapters,
					days: values.differentDays.size,
				}))
				.toSorted((a, b) => {
					if (b.books !== a.books) {
						return b.books - a.books;
					}
					return b.chapters - a.chapters;
				}),
		};
	}
}
