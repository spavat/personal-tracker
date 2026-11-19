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
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { EntityKind } from "../database/node.query.js";

import { BadRequestError, ConflictError, NotFoundError } from "../common/errors.js";
import { ContextTagsRepository } from "../context-tags/context-tags.repository.js";
import { toEntityView } from "../entities/entity.entity.js";
import { buildInitialReading, getLongestConsecutiveStreak, median } from "./book.entity.js";
import { BookRepository } from "./book.repository.js";
import { CoverStorage } from "./cover.storage.js";
import { buildSeriesTree, createsCycle, parentsOf, treeBookIds } from "./series.entity.js";

export type BookListQuery = z.infer<typeof BookListRequestSchema>;
export type SaveBookBody = z.infer<typeof SaveBookRequestSchema>;
export type SaveReadingBody = z.infer<typeof SaveReadingRequestSchema>;

function isDateBetween(dateStr: string, fromStr: string, toStr: string) {
	return dateStr >= fromStr && dateStr <= toStr;
}

@Injectable()
export class ReadingBookService {
	private readonly logger = new Logger(ReadingBookService.name);

	constructor(
		private readonly repo: BookRepository,
		private readonly covers: CoverStorage,
		private readonly contextTagRepo: ContextTagsRepository,
	) {}

	listBooks({ sort, from, to, withReadingsDetails }: BookListQuery) {
		this.logger.log("listBooks");
		const [sortField, sortDirection] = sort ?? ["lastReadDate", "desc"];
		return this.repo.findAll({ from, to, withReadingsDetails, sortField, sortDirection });
	}

	async getBook(id: string) {
		this.logger.log("getBook");
		return (await this.repo.findById(id)) ?? notFound("Livre introuvable");
	}

	async saveBook(book: SaveBookBody) {
		this.logger.log("saveBook");
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

	async listAuthors() {
		this.logger.log("listAuthors");
		return (await this.repo.findAuthors()).map(toEntityView);
	}

	async getAuthor(id: string): Promise<AuthorDetails> {
		this.logger.log("getAuthor");
		const author = await this.repo.findEntity(id);
		if (!author) {
			notFound("Auteur·ice introuvable");
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

	async listSeries() {
		this.logger.log("listSeries");
		const [series, items] = await Promise.all([this.repo.findAllSeries(), this.repo.findAllSeriesItems()]);
		const seriesById = new Map(series.map((item) => [item.id, item]));
		return series.map(({ id, title }) => ({
			id,
			title,
			nbBooks: treeBookIds(id, items).length,
			parents: parentsOf(id, items, seriesById),
		}));
	}

	async getSeries(id: string): Promise<SeriesDetails> {
		this.logger.log("getSeries");
		const series = await this.repo.findSeries(id);
		if (!series) {
			notFound("Série introuvable");
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

	async saveSeries(series: SaveSeriesRequest) {
		this.logger.log("saveSeries");
		const bookIds = series.items.flatMap((item) => (item.kind === "book" ? [item.bookId] : []));
		const childIds = series.items.flatMap((item) => (item.kind === "series" ? [item.seriesId] : []));
		if (new Set(bookIds).size !== bookIds.length || new Set(childIds).size !== childIds.length) {
			throw new BadRequestError("Un livre ou une série n'est qu'une fois dans une série");
		}
		if ((await this.repo.countBooks(bookIds)) !== bookIds.length) {
			throw new BadRequestError("Livre inconnu");
		}
		if ((await this.repo.countSeries(childIds)) !== childIds.length) {
			throw new BadRequestError("Série inconnue");
		}
		// a new series is held by none: it can't be in its own tree
		if (series.id && createsCycle(series.id, childIds, await this.repo.findAllSeriesItems())) {
			throw new BadRequestError("Une série ne peut pas se contenir elle-même, même par une sous-série");
		}
		const id = await this.repo.saveSeries(series);
		if (!id) {
			throw new NotFoundError("Série introuvable");
		}
		return { id };
	}

	async deleteSeries(id: string) {
		this.logger.log("deleteSeries");
		if (!(await this.repo.findSeries(id))) {
			throw new NotFoundError("Série introuvable");
		}
		await this.repo.deleteSeries(id);
	}

	async saveModel(bookId: string, model: SaveBookModelRequest) {
		this.logger.log("saveModel");
		if (!(await this.repo.saveModel(bookId, model))) {
			throw new NotFoundError(model.id ? "Modèle introuvable" : "Livre introuvable");
		}
	}

	async deleteModel(bookId: string, modelId: string) {
		this.logger.log("deleteModel");
		const model = await this.repo.findModel(bookId, modelId);
		if (!model) {
			throw new NotFoundError("Modèle introuvable");
		}
		// their readings point to its chapters
		if (model.nbReadEditions > 0) {
			throw new ConflictError("Ce modèle est utilisé par une édition qui a des lectures");
		}
		await this.repo.deleteModel(bookId, modelId);
	}

	async addReading(bookId: string, editionId: string) {
		this.logger.log("addReading");
		if (!(await this.repo.pushReading(bookId, editionId, buildInitialReading()))) {
			throw new NotFoundError("Édition introuvable");
		}
	}

	async saveEdition(bookId: string, edition: SaveEditionRequest) {
		this.logger.log("saveEdition");
		const current = edition.id ? await this.repo.findEdition(bookId, edition.id) : undefined;
		if (edition.id && !current) {
			throw new NotFoundError("Édition introuvable");
		}
		await assertEntities(this.repo, edition.publisherId ? [edition.publisherId] : [], ["organization"]);
		await assertEntities(
			this.repo,
			edition.translators.map(({ entityId }) => entityId),
			["person"],
		);
		if (edition.modelId && !(await this.repo.findModel(bookId, edition.modelId))) {
			throw new BadRequestError("Ce modèle n'est pas un modèle du livre");
		}
		// the entries of its readings point to the chapters of its model
		if (current && current.nbReadings > 0 && current.modelId !== edition.modelId) {
			throw new ConflictError("Le modèle d'une édition qui a des lectures ne peut pas changer");
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
				await this.deleteCover(coverKey);
			}
			throw new NotFoundError("Livre introuvable");
		}
		// the former cover was replaced or removed
		if (current?.coverKey && current.coverKey !== coverKey) {
			await this.deleteCover(current.coverKey);
		}
	}

	async deleteEdition(bookId: string, editionId: string) {
		this.logger.log("deleteEdition");
		const edition = await this.repo.findEdition(bookId, editionId);
		if (!edition) {
			throw new NotFoundError("Édition introuvable");
		}
		if (edition.nbReadings > 0) {
			throw new ConflictError("Cette édition a des lectures : supprimez-les d'abord");
		}
		if (edition.nbBookEditions <= 1) {
			throw new ConflictError("Un livre garde au moins une édition");
		}
		await this.repo.deleteEdition(bookId, editionId);
		if (edition.coverKey) {
			await this.deleteCover(edition.coverKey);
		}
	}

	saveReading(bookId: string, reading: SaveReadingBody) {
		this.logger.log("saveReading");
		return this.repo.updateReading(bookId, reading);
	}

	deleteReading(bookId: string, readingId: string) {
		this.logger.log("deleteReading");
		return this.repo.deleteReading(bookId, readingId);
	}

	async report({ from, to }: { from: string; to: string }): Promise<GetReportResponse> {
		this.logger.log("report");
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

	// A cover left behind in S3 is harmless: its deletion never fails the request
	private async deleteCover(key: string) {
		try {
			await this.covers.deleteObject(key);
		} catch (error) {
			this.logger.warn(`cover not deleted (${key}): ${String(error)}`);
		}
	}
}

// The credited entities must exist, with the kind the credit expects
async function assertEntities(repo: BookRepository, ids: string[], kinds: EntityKind[]) {
	if ((await repo.countEntities(ids, kinds)) !== new Set(ids).size) {
		throw new BadRequestError(kinds.includes("organization") ? "Organisation inconnue" : "Personne inconnue");
	}
}

function notFound(message: string): never {
	throw new NotFoundError(message);
}
