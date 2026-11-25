import type { ExternalIds } from "@personal-tracker/shared/common";
import type { ErrorResource } from "@personal-tracker/shared/errors";
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
	EntityBooksResponse,
} from "@personal-tracker/shared/reading-book";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { EntityBookRoleSchema } from "@personal-tracker/shared/reading-book";
import { randomUUID } from "node:crypto";

import type { EntityKind } from "../database/node.query.js";

import { BadRequestError, ConflictError, NotFoundError } from "../common/errors.js";
import { ContextTagsRepository } from "../context-tags/context-tags.repository.js";
import { isExternalIdTaken } from "../database/node.query.js";
import { toEntityView } from "../entities/entity.entity.js";
import { buildInitialReading, getLongestConsecutiveStreak, median } from "./book.entity.js";
import { BookRepository } from "./book.repository.js";
import { CoverStorage } from "./cover.storage.js";
import { buildSeriesTree, createsCycle, parentsOf, treeBookIds } from "./series.entity.js";

export type BookListQuery = z.infer<typeof BookListRequestSchema>;
export type SaveBookBody = z.infer<typeof SaveBookRequestSchema>;
// the body, with the id of the path on an update (none: created)
type WithId<T> = T & { id?: string };
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
		return (await this.repo.findById(id)) ?? notFound("book");
	}

	async saveBook(book: WithId<SaveBookBody>) {
		this.logger.log("saveBook");
		await assertEntities(
			this.repo,
			book.authors.map(({ entityId }) => entityId),
			["person"],
		);
		await assertExternalIdsFree(this.repo, book.externalIds, book.id);
		let bookId = book.id;
		try {
			if (bookId) {
				await this.repo.update(bookId, book);
			} else {
				bookId = randomUUID();
				await this.repo.insert(bookId, book);
			}
		} catch (error) {
			throw externalIdTakenOr(error, book.externalIds);
		}
		return (await this.repo.findById(bookId)) ?? notFound("book");
	}

	async listAuthors() {
		this.logger.log("listAuthors");
		return (await this.repo.findAuthors()).map(toEntityView);
	}

	async getAuthor(id: string): Promise<AuthorDetails> {
		this.logger.log("getAuthor");
		const author = await this.repo.findEntity(id);
		if (!author) {
			notFound("author");
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

	// in publication order, the roles in the order of EntityBookRoleSchema
	async getEntityBooks(entityId: string): Promise<EntityBooksResponse> {
		this.logger.log("getEntityBooks");
		const credits = await this.repo.findEntityBookRoles(entityId);
		const bookIds = [...new Set(credits.map(({ bookId }) => bookId))];
		const books = bookIds.length
			? await this.repo.findAll({
					withReadingsDetails: false,
					bookIds,
					sortField: "originalYear",
					sortDirection: "asc",
				})
			: [];
		return EntityBookRoleSchema.options
			.map((role) => {
				const ids = new Set(credits.filter((credit) => credit.role === role).map(({ bookId }) => bookId));
				return { role, books: books.filter((book) => ids.has(book.id)) };
			})
			.filter(({ books }) => books.length);
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
			notFound("series");
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

	async saveSeries(series: WithId<SaveSeriesRequest>) {
		this.logger.log("saveSeries");
		const bookIds = series.items.flatMap((item) => (item.kind === "book" ? [item.bookId] : []));
		const childIds = series.items.flatMap((item) => (item.kind === "series" ? [item.seriesId] : []));
		if (new Set(bookIds).size !== bookIds.length || new Set(childIds).size !== childIds.length) {
			throw new BadRequestError("duplicate_items", "an item is twice in the series", { resource: "series" });
		}
		if ((await this.repo.countBooks(bookIds)) !== bookIds.length) {
			throw new BadRequestError("invalid_reference", "unknown book", { resource: "book" });
		}
		if ((await this.repo.countSeries(childIds)) !== childIds.length) {
			throw new BadRequestError("invalid_reference", "unknown series", { resource: "series" });
		}
		// a new series is held by none: it can't be in its own tree
		if (series.id && createsCycle(series.id, childIds, await this.repo.findAllSeriesItems())) {
			throw new BadRequestError("cycle", "a series can't contain itself", { resource: "series" });
		}
		const id = await this.repo.saveSeries(series);
		if (!id) {
			throw new NotFoundError("series");
		}
		return this.getSeries(id);
	}

	async deleteSeries(id: string) {
		this.logger.log("deleteSeries");
		if (!(await this.repo.findSeries(id))) {
			throw new NotFoundError("series");
		}
		await this.repo.deleteSeries(id);
	}

	async saveModel(bookId: string, model: WithId<SaveBookModelRequest>) {
		this.logger.log("saveModel");
		const id = await this.repo.saveModel(bookId, model);
		if (!id) {
			throw new NotFoundError(model.id ? "model" : "book");
		}
		return (await this.getBook(bookId)).models.find((m) => m.id === id) ?? notFound("model");
	}

	async deleteModel(bookId: string, modelId: string) {
		this.logger.log("deleteModel");
		const model = await this.repo.findModel(bookId, modelId);
		if (!model) {
			throw new NotFoundError("model");
		}
		// their readings point to its chapters
		if (model.nbReadEditions > 0) {
			throw new ConflictError("has_dependents", "the model is used by an edition with readings", {
				resource: "model",
				dependent: "readings",
			});
		}
		await this.repo.deleteModel(bookId, modelId);
	}

	async addReading(bookId: string, editionId: string) {
		this.logger.log("addReading");
		const reading = buildInitialReading();
		if (!(await this.repo.pushReading(bookId, editionId, reading))) {
			throw new NotFoundError("edition");
		}
		// no entry yet: as GET /books/:id gives it
		return reading;
	}

	async saveEdition(bookId: string, edition: WithId<SaveEditionRequest>) {
		this.logger.log("saveEdition");
		const current = edition.id ? await this.repo.findEdition(bookId, edition.id) : undefined;
		if (edition.id && !current) {
			throw new NotFoundError("edition");
		}
		await assertEntities(this.repo, edition.publisherId ? [edition.publisherId] : [], ["organization"]);
		await assertEntities(
			this.repo,
			edition.translators.map(({ entityId }) => entityId),
			["person"],
		);
		await assertExternalIdsFree(this.repo, edition.externalIds, edition.id);
		if (edition.modelId && !(await this.repo.findModel(bookId, edition.modelId))) {
			throw new BadRequestError("invalid_reference", "not a model of the book", { resource: "model" });
		}
		// the entries of its readings point to the chapters of its model
		if (current && current.nbReadings > 0 && current.modelId !== edition.modelId) {
			throw new ConflictError("edition.model_locked", "the model of an edition with readings can't change");
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

		// the cover just uploaded is of no use when the edition isn't saved
		const dropNewCover = async () => {
			if (coverKey && coverKey !== current?.coverKey) {
				await this.deleteCover(coverKey);
			}
		};
		let saved: boolean;
		try {
			saved = await this.repo.saveEdition(bookId, !edition.id, { ...fields, id, coverKey });
		} catch (error) {
			await dropNewCover();
			throw externalIdTakenOr(error, edition.externalIds);
		}
		if (!saved) {
			await dropNewCover();
			throw new NotFoundError("book");
		}
		// the former cover was replaced or removed
		if (current?.coverKey && current.coverKey !== coverKey) {
			await this.deleteCover(current.coverKey);
		}
		return (await this.getBook(bookId)).editions.find((e) => e.id === id) ?? notFound("edition");
	}

	async deleteEdition(bookId: string, editionId: string) {
		this.logger.log("deleteEdition");
		const edition = await this.repo.findEdition(bookId, editionId);
		if (!edition) {
			throw new NotFoundError("edition");
		}
		if (edition.nbReadings > 0) {
			throw new ConflictError("has_dependents", "the edition has readings", {
				resource: "edition",
				dependent: "readings",
			});
		}
		if (edition.nbBookEditions <= 1) {
			throw new ConflictError("book.last_edition", "a book keeps one edition");
		}
		await this.repo.deleteEdition(bookId, editionId);
		if (edition.coverKey) {
			await this.deleteCover(edition.coverKey);
		}
	}

	async saveReading(bookId: string, reading: SaveReadingBody) {
		this.logger.log("saveReading");
		if (!(await this.repo.updateReading(bookId, reading))) {
			notFound("reading");
		}
		return this.findReading(bookId, reading.id);
	}

	async deleteReading(bookId: string, readingId: string) {
		this.logger.log("deleteReading");
		if (!(await this.repo.deleteReading(bookId, readingId))) {
			notFound("reading");
		}
	}

	// a reading as GET /books/:id gives it, inside its edition
	private async findReading(bookId: string, readingId: string) {
		const book = await this.getBook(bookId);
		return (
			book.editions.flatMap((edition) => edition.readings).find((r) => r.id === readingId) ?? notFound("reading")
		);
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
					reading.status === "complete" && !isDateBetween(reading.lastReadDate ?? "", from, to)
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
		throw new BadRequestError("invalid_reference", "unknown entity", {
			resource: kinds.includes("organization") ? "organization" : "person",
		});
	}
}

// an outside id names a single book or edition
async function assertExternalIdsFree(repo: BookRepository, externalIds: ExternalIds | undefined, nodeId?: string) {
	const taken = externalIds && (await repo.findTakenExternalId(externalIds, nodeId));
	if (taken) {
		throw new ConflictError("external_id_taken", "the external id is already on another node", taken);
	}
}

// a save that lost the race for an external id (checked free, then saved elsewhere first) answers as the check would
function externalIdTakenOr(error: unknown, externalIds: ExternalIds | undefined) {
	if (!isExternalIdTaken(error)) {
		return error;
	}
	const [source, externalId] = Object.entries(externalIds ?? {})[0] ?? [];
	return new ConflictError("external_id_taken", "the external id was saved on another node meanwhile", {
		...(source && { source }),
		...(externalId && { externalId }),
	});
}

function notFound(resource: ErrorResource): never {
	throw new NotFoundError(resource);
}
