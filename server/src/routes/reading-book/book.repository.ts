import type { BookOverview, ReadingDetails, ReadingModelItem } from "@personal-tracker/shared/reading-book";
import type { FastifyInstance } from "fastify";

import { and, asc, between, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { ReadingStatus } from "./book.entity";

import { createNode, findOrCreatePerson, renameNode, type Tx } from "../../db/node";
import {
	coreEntity,
	readingBook,
	readingBookContributor,
	readingEdition,
	readingEntry,
	readingModel,
	readingReading,
} from "../../db/schema";
import { toBook, toDetails, toEntries } from "./book.entity";

interface BookListFilters {
	from?: string;
	to?: string;
	withReadingsDetails: boolean;
	sortField?: string;
	sortDirection?: string;
	limit?: number;
}

export interface BookFields {
	book: string;
	author: string[];
	language: string;
	country: string;
	pages: number | null;
}

const WITH_DETAILS = {
	contributors: { with: { entity: true }, orderBy: { order: "asc" } },
	editions: {
		with: {
			model: true,
			readings: { with: { entries: { orderBy: { date: "asc" } } } },
		},
	},
} as const;

export class BookRepository {
	constructor(private db: FastifyInstance["db"]) {}

	// With a period, a book or a reading is listed when it has an entry in it, and its details only hold
	// the entries in it. A reading's own dates always come from all its entries.
	async findAll({
		from,
		to,
		withReadingsDetails,
		sortField = "book",
		sortDirection = "asc",
		limit,
	}: BookListFilters) {
		const inPeriod = from && to ? between(readingEntry.date, from, to) : undefined;

		const firstReadDate = sql<string | null>`min(${readingEntry.date})::text`;
		const lastReadDate = sql<string | null>`max(${readingEntry.date})::text`;
		// with a period, only the readings with an entry in it count
		const nbReadings =
			sql<number>`count(distinct ${inPeriod ? readingEntry.readingId : readingReading.id})`.mapWith(Number);
		const authors = sql<string[]>`coalesce((
			select array_agg(${coreEntity.name} order by ${readingBookContributor.order})
			from ${readingBookContributor} join ${coreEntity} on ${coreEntity.id} = ${readingBookContributor.entityId}
			where ${readingBookContributor.bookId} = ${readingBook.id} and ${readingBookContributor.role} = 'author'
		), '{}')`;
		const sortValues: Record<string, SQL | typeof readingBook.title> = {
			book: readingBook.title,
			author: sql`(${authors})[1]`,
			language: sql`${readingEdition.language}`,
			country: sql`${readingBook.country}`,
			nbReadings,
			firstReadDate,
			lastReadDate,
			pages: sql`${readingEdition.pages}`,
		};
		const sortValue = sortValues[sortField] ?? readingBook.title;

		const query = this.db
			.select({
				id: readingBook.id,
				book: readingBook.title,
				author: authors,
				language: readingEdition.language,
				country: readingBook.country,
				pages: readingEdition.pages,
				model: readingModel.tree,
				readingDates: sql<
					string[]
				>`coalesce(array_agg(distinct ${readingEntry.date}::text) filter (where ${readingEntry.date} is not null), '{}')`,
				firstReadDate,
				lastReadDate,
				nbReadings,
			})
			.from(readingBook)
			.innerJoin(readingEdition, eq(readingEdition.bookId, readingBook.id))
			.leftJoin(readingModel, eq(readingModel.id, readingEdition.modelId))
			.leftJoin(readingReading, eq(readingReading.editionId, readingEdition.id))
			.leftJoin(readingEntry, and(eq(readingEntry.readingId, readingReading.id), inPeriod))
			.groupBy(readingBook.id, readingEdition.id, readingModel.id)
			.having(inPeriod ? sql`count(${readingEntry.date}) > 0` : undefined)
			.orderBy(
				sql`${sortValue} ${sql.raw(sortDirection === "desc" ? "desc" : "asc")} nulls last`,
				asc(readingBook.title),
			)
			.$dynamic();
		const books = await (limit ? query.limit(limit) : query);
		if (!books.length) {
			return [];
		}

		const readings = await this.db
			.select({
				id: readingReading.id,
				bookId: readingEdition.bookId,
				status: readingReading.status,
				readingDates: sql<
					string[]
				>`coalesce(array_agg(distinct ${readingEntry.date}::text) filter (where ${readingEntry.date} is not null), '{}')`,
				firstReadDate,
				lastReadDate,
			})
			.from(readingReading)
			.innerJoin(readingEdition, eq(readingEdition.id, readingReading.editionId))
			.leftJoin(readingEntry, eq(readingEntry.readingId, readingReading.id))
			.where(
				inArray(
					readingEdition.bookId,
					books.map(({ id }) => id),
				),
			)
			.groupBy(readingReading.id, readingEdition.bookId)
			.having(inPeriod ? sql`bool_or(${inPeriod})` : undefined)
			.orderBy(sql`${firstReadDate} nulls last`);

		const entries = withReadingsDetails
			? await this.db
					.select({
						readingId: readingEntry.readingId,
						chapterId: readingEntry.chapterId,
						date: readingEntry.date,
						tags: readingEntry.tags,
					})
					.from(readingEntry)
					.where(
						and(
							inArray(
								readingEntry.readingId,
								readings.map(({ id }) => id),
							),
							inPeriod,
						),
					)
					.orderBy(asc(readingEntry.date))
			: [];

		return books.map((book) => ({
			...book,
			country: book.country ?? "",
			language: book.language ?? "",
			model: book.model ?? [],
			readings: readings
				.filter(({ bookId }) => bookId === book.id)
				.map(({ bookId: _bookId, ...reading }) =>
					withReadingsDetails
						? {
								...reading,
								details: toDetails(entries.filter(({ readingId }) => readingId === reading.id)),
							}
						: reading,
				),
		})) as BookOverview[];
	}

	async findById(id: string) {
		const row = await this.db.query.readingBook.findFirst({ where: { id }, with: WITH_DETAILS });
		return row ? toBook(row) : undefined;
	}

	// A new book comes with its edition and an empty model
	insert(id: string, { book, author, language, country, pages }: BookFields) {
		return this.db.transaction(async (tx) => {
			await createNode(tx, { type: "book", label: book, id });
			await tx.insert(readingBook).values({ id, title: book, country });
			await this.replaceAuthors(tx, id, author);
			const [model] = await tx
				.insert(readingModel)
				.values({ bookId: id, name: "Modèle" })
				.returning({ id: readingModel.id });
			await tx.insert(readingEdition).values({ bookId: id, language, pages, modelId: model.id });
		});
	}

	update(id: string, { book, author, language, country, pages }: BookFields) {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(readingBook)
				.set({ title: book, country })
				.where(eq(readingBook.id, id))
				.returning({ id: readingBook.id });
			if (!updated) {
				return;
			}
			await renameNode(tx, id, book);
			await this.replaceAuthors(tx, id, author);
			await tx.update(readingEdition).set({ language, pages }).where(eq(readingEdition.bookId, id));
		});
	}

	private async replaceAuthors(tx: Tx, bookId: string, authors: string[]) {
		await tx
			.delete(readingBookContributor)
			.where(and(eq(readingBookContributor.bookId, bookId), eq(readingBookContributor.role, "author")));
		// a name listed twice is credited once
		for (const [order, name] of [...new Set(authors)].entries()) {
			const entityId = await findOrCreatePerson(tx, name);
			await tx.insert(readingBookContributor).values({ bookId, entityId, role: "author", order });
		}
	}

	async updateModel(bookId: string, tree: ReadingModelItem[]) {
		await this.db.update(readingModel).set({ tree }).where(eq(readingModel.bookId, bookId));
	}

	async pushReading(bookId: string, { id, status }: { id: string; status: ReadingStatus }) {
		const [edition] = await this.db
			.select({ id: readingEdition.id })
			.from(readingEdition)
			.where(eq(readingEdition.bookId, bookId))
			.limit(1);
		if (edition) {
			await this.db.insert(readingReading).values({ id, editionId: edition.id, status });
		}
	}

	updateReading(bookId: string, reading: { id: string; status: ReadingStatus; details: ReadingDetails[] }) {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(readingReading)
				.set({ status: reading.status })
				.where(this.readingOfBook(bookId, reading.id))
				.returning({ id: readingReading.id });
			if (!updated) {
				return;
			}
			// the entries are replaced as a whole
			await tx.delete(readingEntry).where(eq(readingEntry.readingId, reading.id));
			const { entries } = toEntries(reading.id, reading.details);
			if (entries.length) {
				await tx.insert(readingEntry).values(entries);
			}
		});
	}

	async deleteReading(bookId: string, readingId: string) {
		await this.db.delete(readingReading).where(this.readingOfBook(bookId, readingId));
	}

	private readingOfBook(bookId: string, readingId: string) {
		return and(
			eq(readingReading.id, readingId),
			inArray(
				readingReading.editionId,
				this.db.select({ id: readingEdition.id }).from(readingEdition).where(eq(readingEdition.bookId, bookId)),
			),
		);
	}
}
