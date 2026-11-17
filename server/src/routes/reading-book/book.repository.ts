import type { ReadingDetails, ReadingModelItem } from "@personal-tracker/shared/reading-book";
import type { FastifyInstance } from "fastify";

import { and, eq, inArray } from "drizzle-orm";

import type { ReadingStatus } from "./book.entity";

import { createNode, findOrCreatePerson, renameNode, type Tx } from "../../db/node";
import {
	readingBook,
	readingBookContributor,
	readingEdition,
	readingEntry,
	readingModel,
	readingReading,
} from "../../db/schema";
import { sortBookOverviews, toBook, toBookOverviews, toEntries } from "./book.entity";

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

	// The whole list is loaded then shaped in memory (book.entity.ts), like the former Mongo aggregation
	async findAll({ sortField = "book", sortDirection = "asc", limit, ...filters }: BookListFilters) {
		const rows = await this.db.query.readingBook.findMany({ with: WITH_DETAILS, orderBy: { title: "asc" } });
		const books = sortBookOverviews(toBookOverviews(rows.map(toBook), filters), sortField, sortDirection);
		return limit ? books.slice(0, limit) : books;
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
