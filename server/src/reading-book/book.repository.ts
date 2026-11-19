import type {
	BookModel,
	BookOverview,
	BookSeries,
	Credit,
	SaveSeriesItem,
	ReadingDetails,
	ReadingModelItem,
} from "@personal-tracker/shared/reading-book";

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, between, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { EditionType, ReadingStatus } from "./book.entity.js";

import { DRIZZLE } from "../database/database.tokens.js";
import { Drizzle } from "../database/drizzle.js";
import { createNode, type EntityKind, renameNode, type Tx } from "../database/node.query.js";
import {
	coreEntity,
	coreNode,
	readingBook,
	readingBookContributor,
	readingEdition,
	readingEditionContributor,
	readingEntry,
	readingModel,
	readingReading,
	readingSeries,
	readingSeriesItem,
} from "../database/schema.js";
import { coverUrl, toBook, toDetails, toEntries } from "./book.entity.js";

interface BookListFilters {
	from?: string;
	to?: string;
	withReadingsDetails: boolean;
	sortField?: string;
	sortDirection?: string;
	limit?: number;
	// only the books credited to this entity as author
	authorId?: string;
	// only these books (the books of a series' tree)
	bookIds?: string[];
}

export type CreditFields = { entityId: string; creditedAs: string | null };

export interface BookFields {
	book: string;
	authors: CreditFields[];
	originalLanguage: string;
	originalYear: number | null;
	country: string;
}

export interface EditionFields {
	id: string;
	title: string | null;
	publisherId: string | null;
	collection: string | null;
	translators: CreditFields[];
	language: string | null;
	pages: number | null;
	type: EditionType;
	isbn: string | null;
	year: number | null;
	coverKey: string | null;
	modelId: string | null;
}

const WITH_DETAILS = {
	contributors: { with: { entity: true }, orderBy: { order: "asc" } },
	models: { orderBy: { name: "asc" } },
	// the series the book is directly in, and the series holding them
	series: { with: { series: { with: { parentItems: { with: { series: true } } } } } },
	editions: {
		orderBy: { createdAt: "asc" },
		with: {
			publisher: true,
			contributors: { with: { entity: true }, orderBy: { order: "asc" } },
			readings: { with: { entries: { orderBy: { date: "asc" } } } },
		},
	},
} as const;

const mainEdition = alias(readingEdition, "main_edition");

@Injectable()
export class BookRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	// With a period, a book or a reading is listed when it has an entry in it, and its details only hold
	// the entries in it. A reading's own dates always come from all its entries.
	async findAll({
		from,
		to,
		withReadingsDetails,
		sortField = "book",
		sortDirection = "asc",
		limit,
		authorId,
		bookIds,
	}: BookListFilters) {
		const inPeriod = from && to ? between(readingEntry.date, from, to) : undefined;

		const firstReadDate = sql<string | null>`min(${readingEntry.date})::text`;
		const lastReadDate = sql<string | null>`max(${readingEntry.date})::text`;
		// with a period, only the readings with an entry in it count
		const nbReadings =
			sql<number>`count(distinct ${inPeriod ? readingEntry.readingId : readingReading.id})`.mapWith(Number);
		const authors = sql<Credit[]>`coalesce((
			select json_agg(
				json_build_object('entityId', e.id, 'name', e.name, 'creditedAs', bc.credited_as) order by bc."order"
			)
			from ${readingBookContributor} bc join ${coreEntity} e on e.id = bc.entity_id
			where bc.book_id = ${readingBook.id} and bc.role = 'author'
		), '[]')`;
		// by the sort name of the first author ("Carroll, Lewis"), else its name
		const firstAuthor = sql`(
			select coalesce(e.sort_name, e.name)
			from ${readingBookContributor} bc join ${coreEntity} e on e.id = bc.entity_id
			where bc.book_id = ${readingBook.id} and bc.role = 'author'
			order by bc."order" limit 1
		)`;
		// the edition of the latest reading, else the first one
		const mainEditionId = sql`(
			select e.id from ${readingEdition} e
			left join ${readingReading} r on r.edition_id = e.id
			left join ${readingEntry} en on en.reading_id = r.id
			where e.book_id = ${readingBook.id}
			group by e.id
			order by max(en.date) desc nulls last, e.created_at, e.id
			limit 1
		)`;
		const sortValues: Record<string, SQL | typeof readingBook.title> = {
			book: readingBook.title,
			author: firstAuthor,
			originalYear: sql`${readingBook.originalYear}`,
			language: sql`${mainEdition.language}`,
			country: sql`${readingBook.country}`,
			nbReadings,
			firstReadDate,
			lastReadDate,
			pages: sql`${mainEdition.pages}`,
		};
		const sortValue = sortValues[sortField] ?? readingBook.title;

		const query = this.db
			.select({
				id: readingBook.id,
				book: readingBook.title,
				authors,
				originalLanguage: readingBook.originalLanguage,
				originalYear: readingBook.originalYear,
				language: mainEdition.language,
				country: readingBook.country,
				pages: mainEdition.pages,
				editionTitle: mainEdition.title,
				mainEditionId: mainEdition.id,
				coverKey: mainEdition.coverKey,
				// the series the book is directly in, each with the series holding it
				series: sql<BookSeries[]>`coalesce((
					select json_agg(
						json_build_object(
							'id', s.id, 'title', s.title, 'position', si.position, 'positionLabel', si.position_label,
							'parents', coalesce((
								select json_agg(json_build_object('id', p.id, 'title', p.title) order by p.title)
								from ${readingSeriesItem} pi join ${readingSeries} p on p.id = pi.series_id
								where pi.child_series_id = s.id
							), '[]')
						)
						order by s.title
					)
					from ${readingSeriesItem} si join ${readingSeries} s on s.id = si.series_id
					where si.book_id = ${readingBook.id}
				), '[]')`,
				models: sql<BookModel[]>`coalesce((
					select json_agg(json_build_object('id', m.id, 'name', m.name, 'tree', m.tree) order by m.name)
					from ${readingModel} m where m.book_id = ${readingBook.id}
				), '[]')`,
				readingDates: sql<
					string[]
				>`coalesce(array_agg(distinct ${readingEntry.date}::text) filter (where ${readingEntry.date} is not null), '{}')`,
				firstReadDate,
				lastReadDate,
				nbReadings,
			})
			.from(readingBook)
			.leftJoin(mainEdition, eq(mainEdition.id, mainEditionId))
			.leftJoin(readingEdition, eq(readingEdition.bookId, readingBook.id))
			.leftJoin(readingReading, eq(readingReading.editionId, readingEdition.id))
			.leftJoin(readingEntry, and(eq(readingEntry.readingId, readingReading.id), inPeriod))
			.where(
				and(
					authorId
						? sql`exists (
							select 1 from ${readingBookContributor} bc
							where bc.book_id = ${readingBook.id} and bc.role = 'author' and bc.entity_id = ${authorId}
						)`
						: undefined,
					bookIds ? inArray(readingBook.id, bookIds) : undefined,
				),
			)
			.groupBy(readingBook.id, mainEdition.id)
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
				language: readingEdition.language,
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
			.groupBy(readingReading.id, readingEdition.bookId, readingEdition.language)
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

		return books.map(({ mainEditionId, coverKey, ...book }) => ({
			...book,
			editionId: mainEditionId,
			originalLanguage: book.originalLanguage ?? "",
			country: book.country ?? "",
			language: book.language ?? "",
			cover: mainEditionId ? coverUrl(mainEditionId, coverKey) : null,
			readings: readings
				.filter(({ bookId }) => bookId === book.id)
				.map(({ bookId: _bookId, ...reading }) => ({
					...reading,
					language: reading.language ?? "",
					...(withReadingsDetails && {
						details: toDetails(entries.filter(({ readingId }) => readingId === reading.id)),
					}),
				})),
		})) as BookOverview[];
	}

	async findById(id: string) {
		const row = await this.db.query.readingBook.findFirst({ where: { id }, with: WITH_DETAILS });
		return row ? toBook(row) : undefined;
	}

	// A new book comes with an empty model and an empty edition
	insert(id: string, { book, authors, originalLanguage, originalYear, country }: BookFields) {
		return this.db.transaction(async (tx) => {
			await createNode(tx, { type: "book", label: book, id });
			await tx.insert(readingBook).values({
				id,
				title: book,
				originalLanguage: originalLanguage || null,
				originalYear,
				country: country || null,
			});
			await this.replaceAuthors(tx, id, authors);
			const [model] = await tx
				.insert(readingModel)
				.values({ bookId: id, name: "Modèle" })
				.returning({ id: readingModel.id });
			await tx.insert(readingEdition).values({ bookId: id, modelId: model.id });
		});
	}

	update(id: string, { book, authors, originalLanguage, originalYear, country }: BookFields) {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(readingBook)
				.set({
					title: book,
					originalLanguage: originalLanguage || null,
					originalYear,
					country: country || null,
				})
				.where(eq(readingBook.id, id))
				.returning({ id: readingBook.id });
			if (!updated) {
				return;
			}
			await renameNode(tx, id, book);
			await this.replaceAuthors(tx, id, authors);
		});
	}

	private async replaceAuthors(tx: Tx, bookId: string, authors: CreditFields[]) {
		await tx
			.delete(readingBookContributor)
			.where(and(eq(readingBookContributor.bookId, bookId), eq(readingBookContributor.role, "author")));
		const credits = uniqueCredits(authors);
		if (credits.length) {
			await tx
				.insert(readingBookContributor)
				.values(credits.map((credit, order) => ({ ...credit, bookId, role: "author" as const, order })));
		}
	}

	// how many of these entities exist with one of these kinds
	async countEntities(ids: string[], kinds: EntityKind[]) {
		if (!ids.length) {
			return 0;
		}
		const [{ count }] = await this.db
			.select({ count: sql<number>`count(*)`.mapWith(Number) })
			.from(coreEntity)
			.where(and(inArray(coreEntity.id, [...new Set(ids)]), inArray(coreEntity.kind, kinds)));
		return count;
	}

	// The entities credited as author, with how many of their books are in the tracker and read
	findAuthors() {
		return this.db
			.select({
				id: coreEntity.id,
				name: coreEntity.name,
				sortName: coreEntity.sortName,
				pictureKey: coreEntity.pictureKey,
				nbBooks: sql<number>`count(distinct ${readingBookContributor.bookId})`.mapWith(Number),
				nbReadings: sql<number>`count(distinct ${readingReading.id})`.mapWith(Number),
			})
			.from(coreEntity)
			.innerJoin(
				readingBookContributor,
				and(eq(readingBookContributor.entityId, coreEntity.id), eq(readingBookContributor.role, "author")),
			)
			.leftJoin(readingEdition, eq(readingEdition.bookId, readingBookContributor.bookId))
			.leftJoin(readingReading, eq(readingReading.editionId, readingEdition.id))
			.groupBy(coreEntity.id)
			.orderBy(sql`coalesce(${coreEntity.sortName}, ${coreEntity.name})`);
	}

	async findEntity(id: string) {
		const [entity] = await this.db
			.select({
				id: coreEntity.id,
				kind: coreEntity.kind,
				name: coreEntity.name,
				sortName: coreEntity.sortName,
				pictureKey: coreEntity.pictureKey,
			})
			.from(coreEntity)
			.where(eq(coreEntity.id, id));
		return entity;
	}

	// undefined when the book has no such edition
	async findEdition(bookId: string, editionId: string) {
		const [edition] = await this.db
			.select({
				id: readingEdition.id,
				coverKey: readingEdition.coverKey,
				modelId: readingEdition.modelId,
				// a single-table select leaves its columns unqualified ("id"): in a correlated subquery they would
				// name the subquery's own table, so the outer row is named explicitly
				nbReadings: sql<number>`(
					select count(*) from ${readingReading} r where r.edition_id = ${readingEdition}.id
				)`.mapWith(Number),
				nbBookEditions: sql<number>`(
					select count(*) from ${readingEdition} e where e.book_id = ${readingEdition}.book_id
				)`.mapWith(Number),
			})
			.from(readingEdition)
			.where(and(eq(readingEdition.id, editionId), eq(readingEdition.bookId, bookId)));
		return edition;
	}

	async findCoverKey(editionId: string) {
		const [edition] = await this.db
			.select({ coverKey: readingEdition.coverKey })
			.from(readingEdition)
			.where(eq(readingEdition.id, editionId));
		return edition?.coverKey ?? null;
	}

	// false when the book (on create) or the edition (on update) doesn't exist
	saveEdition(bookId: string, isNew: boolean, { id, translators, ...fields }: EditionFields) {
		return this.db.transaction(async (tx) => {
			if (isNew) {
				const [book] = await tx
					.select({ id: readingBook.id })
					.from(readingBook)
					.where(eq(readingBook.id, bookId));
				if (!book) {
					return false;
				}
				await tx.insert(readingEdition).values({ id, bookId, ...fields });
			} else {
				const [updated] = await tx
					.update(readingEdition)
					.set(fields)
					.where(and(eq(readingEdition.id, id), eq(readingEdition.bookId, bookId)))
					.returning({ id: readingEdition.id });
				if (!updated) {
					return false;
				}
			}
			await tx
				.delete(readingEditionContributor)
				.where(
					and(eq(readingEditionContributor.editionId, id), eq(readingEditionContributor.role, "translator")),
				);
			const credits = uniqueCredits(translators);
			if (credits.length) {
				await tx.insert(readingEditionContributor).values(
					credits.map((credit, order) => ({
						...credit,
						editionId: id,
						role: "translator" as const,
						order,
					})),
				);
			}
			return true;
		});
	}

	async deleteEdition(bookId: string, editionId: string) {
		await this.db
			.delete(readingEdition)
			.where(and(eq(readingEdition.id, editionId), eq(readingEdition.bookId, bookId)));
	}

	// undefined when the book has no such model
	async findModel(bookId: string, modelId: string) {
		const [model] = await this.db
			.select({
				id: readingModel.id,
				// its chapters can't change for the editions that are read
				nbReadEditions: sql<number>`(
					select count(distinct e.id) from ${readingEdition} e join ${readingReading} r on r.edition_id = e.id
					where e.model_id = ${readingModel}.id
				)`.mapWith(Number),
			})
			.from(readingModel)
			.where(and(eq(readingModel.id, modelId), eq(readingModel.bookId, bookId)));
		return model;
	}

	// false when the book (on create) or the model (on update) doesn't exist
	// the model's id, undefined for an unknown book or model
	async saveModel(bookId: string, { id, name, tree }: { id?: string; name: string; tree: ReadingModelItem[] }) {
		if (id) {
			const [updated] = await this.db
				.update(readingModel)
				.set({ name, tree })
				.where(and(eq(readingModel.id, id), eq(readingModel.bookId, bookId)))
				.returning({ id: readingModel.id });
			return updated?.id;
		}
		const [book] = await this.db.select({ id: readingBook.id }).from(readingBook).where(eq(readingBook.id, bookId));
		if (!book) {
			return undefined;
		}
		const [created] = await this.db
			.insert(readingModel)
			.values({ bookId, name, tree })
			.returning({ id: readingModel.id });
		return created.id;
	}

	// the editions using it are left without model
	deleteModel(bookId: string, modelId: string) {
		return this.db.transaction(async (tx) => {
			await tx
				.update(readingEdition)
				.set({ modelId: null })
				.where(and(eq(readingEdition.modelId, modelId), eq(readingEdition.bookId, bookId)));
			await tx.delete(readingModel).where(and(eq(readingModel.id, modelId), eq(readingModel.bookId, bookId)));
		});
	}

	// false when the book has no such edition
	async pushReading(bookId: string, editionId: string, { id, status }: { id: string; status: ReadingStatus }) {
		if (!(await this.findEdition(bookId, editionId))) {
			return false;
		}
		await this.db.insert(readingReading).values({ id, editionId, status });
		return true;
	}

	// false when the book has no such reading
	updateReading(bookId: string, reading: { id: string; status: ReadingStatus; details: ReadingDetails[] }) {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(readingReading)
				.set({ status: reading.status })
				.where(this.readingOfBook(bookId, reading.id))
				.returning({ id: readingReading.id });
			if (!updated) {
				return false;
			}
			// the entries are replaced as a whole
			await tx.delete(readingEntry).where(eq(readingEntry.readingId, reading.id));
			const { entries } = toEntries(reading.id, reading.details);
			if (entries.length) {
				await tx.insert(readingEntry).values(entries);
			}
			return true;
		});
	}

	// false when the book has no such reading
	async deleteReading(bookId: string, readingId: string) {
		const deleted = await this.db
			.delete(readingReading)
			.where(this.readingOfBook(bookId, readingId))
			.returning({ id: readingReading.id });
		return deleted.length > 0;
	}

	findAllSeries() {
		return this.db
			.select({ id: readingSeries.id, title: readingSeries.title })
			.from(readingSeries)
			.orderBy(asc(readingSeries.title));
	}

	// all the items of all the series: the trees are built from them (series.entity.ts)
	findAllSeriesItems() {
		return this.db
			.select({
				seriesId: readingSeriesItem.seriesId,
				position: readingSeriesItem.position,
				positionLabel: readingSeriesItem.positionLabel,
				bookId: readingSeriesItem.bookId,
				childSeriesId: readingSeriesItem.childSeriesId,
			})
			.from(readingSeriesItem);
	}

	async findSeries(id: string) {
		const [series] = await this.db
			.select({ id: readingSeries.id, title: readingSeries.title })
			.from(readingSeries)
			.where(eq(readingSeries.id, id));
		return series;
	}

	// how many of these books exist
	async countBooks(ids: string[]) {
		if (!ids.length) {
			return 0;
		}
		const [{ count }] = await this.db
			.select({ count: sql<number>`count(*)`.mapWith(Number) })
			.from(readingBook)
			.where(inArray(readingBook.id, [...new Set(ids)]));
		return count;
	}

	// how many of these series exist
	async countSeries(ids: string[]) {
		if (!ids.length) {
			return 0;
		}
		const [{ count }] = await this.db
			.select({ count: sql<number>`count(*)`.mapWith(Number) })
			.from(readingSeries)
			.where(inArray(readingSeries.id, [...new Set(ids)]));
		return count;
	}

	// The items are rewritten as a whole, positions 1..n in the given order.
	// undefined when updating an unknown series, else its id.
	saveSeries({ id, title, items }: { id?: string; title: string; items: SaveSeriesItem[] }) {
		return this.db.transaction(async (tx) => {
			let seriesId = id;
			if (seriesId) {
				const [updated] = await tx
					.update(readingSeries)
					.set({ title })
					.where(eq(readingSeries.id, seriesId))
					.returning({ id: readingSeries.id });
				if (!updated) {
					return undefined;
				}
				await renameNode(tx, seriesId, title);
				await tx.delete(readingSeriesItem).where(eq(readingSeriesItem.seriesId, seriesId));
			} else {
				seriesId = await createNode(tx, { type: "book_series", label: title });
				await tx.insert(readingSeries).values({ id: seriesId, title });
			}
			const savedId = seriesId;
			if (items.length) {
				await tx.insert(readingSeriesItem).values(
					items.map((item, i) => ({
						seriesId: savedId,
						position: i + 1,
						positionLabel: item.positionLabel,
						bookId: item.kind === "book" ? item.bookId : null,
						childSeriesId: item.kind === "series" ? item.seriesId : null,
					})),
				);
			}
			return seriesId;
		});
	}

	// through its node: its items go with it, and it leaves the series holding it (its books and sub-series stay)
	async deleteSeries(id: string) {
		await this.db.delete(coreNode).where(and(eq(coreNode.id, id), eq(coreNode.type, "book_series")));
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

// an entity listed twice is credited once (the primary key is entity + role), with its first credited name
function uniqueCredits(credits: CreditFields[]) {
	const byEntity = new Map<string, CreditFields>();
	for (const credit of credits) {
		if (!byEntity.has(credit.entityId)) {
			byEntity.set(credit.entityId, credit);
		}
	}
	return [...byEntity.values()];
}
