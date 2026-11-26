import * as z from "zod";

import {
	CountryCodeSchema,
	ExternalIdsSchema,
	ExternalSourceSchema,
	GenericListSchema,
	LanguageCodeSchema,
	PeriodQSSchema,
	UUIDParamsSchema,
} from "./common.schema";

const ReadingContextItemSchema = z.object({
	date: z.iso.date(),
	tags: z.array(z.string()),
});
export type ReadingContextItem = z.infer<typeof ReadingContextItemSchema>;

export const ReadingDetailsSchema = z.object({
	id: z.uuid(),
	context: z.array(ReadingContextItemSchema),
});

export type ReadingDetails = z.infer<typeof ReadingDetailsSchema>;

export const ReadingSchema = z.object({
	id: z.string(),
	status: z.union([z.literal("complete"), z.literal("abandoned"), z.literal("in-progress")]),
	details: z.array(ReadingDetailsSchema),
});

export type ReadingModelItem = {
	id: string;
	title: string;
	content?: ReadingModelItem[];
};

export const ReadingModelItemSchema: z.ZodType<ReadingModelItem> = z.object({
	id: z.uuid(),
	title: z.string().nonempty(),
	content: z.lazy(() => z.array(ReadingModelItemSchema)).optional(),
});

// A table of contents: chapters, possibly grouped in parts
export const ModelSchema = z.array(ReadingModelItemSchema);

// A book's model, shared by the editions with the same chapters
export const BookModelSchema = z.object({
	id: z.uuid(),
	name: z.string().trim().nonempty(),
	tree: ModelSchema,
});
export type BookModel = z.infer<typeof BookModelSchema>;

// A person or organization credited on a book or an edition (core entity)
export const CreditSchema = z.object({
	entityId: z.uuid(),
	name: z.string(),
	// the name printed on this work, when it differs from the entity's (pseudonym, transliteration…)
	creditedAs: z.string().nullable(),
});
export type Credit = z.infer<typeof CreditSchema>;
export const SaveCreditSchema = z.object({
	entityId: z.uuid(),
	creditedAs: z.string().trim().nonempty().nullable(),
});

// The name shown for a credit
export const creditName = (credit: Credit) => credit.creditedAs ?? credit.name;

export const EditionTypeSchema = z.enum(["print", "digital"]);
export type EditionType = z.infer<typeof EditionTypeSchema>;

export const EditionSchema = z.object({
	id: z.uuid(),
	// localized title, the book's when null
	title: z.string().nullable(),
	publisher: z.object({ id: z.uuid(), name: z.string() }).nullable(),
	collection: z.string().nullable(),
	translators: z.array(CreditSchema),
	// an ISO 639-1 code (checked on save only: a stored value never breaks a read)
	language: z.string().nullable(),
	pages: z.number().int().nullable(),
	type: EditionTypeSchema.nullable(),
	isbn: z.string().nullable(),
	year: z.number().int().nullable(),
	// served through /images/reading-book/edition/:id
	cover: z.string().nullable(),
	// the chapters its readings follow
	modelId: z.uuid().nullable(),
	externalIds: ExternalIdsSchema,
	readings: z.array(ReadingSchema),
});
export type Edition = z.infer<typeof EditionSchema>;

const SeriesRefSchema = z.object({ id: z.uuid(), title: z.string() });

// A series the book is directly in: its order in it, the only displayed value ("1", "2.5", "interlude"…),
// and the series holding that one ("Terre du Milieu" for "Le Seigneur des anneaux")
export const BookSeriesSchema = SeriesRefSchema.extend({
	position: z.number().int(),
	positionLabel: z.string().nullable(),
	parents: z.array(SeriesRefSchema),
});
export type BookSeries = z.infer<typeof BookSeriesSchema>;

export const BookSchema = z.object({
	id: z.uuidv4(),
	book: z.string().nonempty(),
	authors: z.array(CreditSchema).min(1),
	// ISO 639-1 and ISO 3166-1 codes, "" = unknown (checked on save only: a stored value never breaks a read)
	originalLanguage: z.string(),
	originalYear: z.number().int().nullable(),
	country: z.string(),
	models: z.array(BookModelSchema),
	editions: z.array(EditionSchema),
	series: z.array(BookSeriesSchema),
	externalIds: ExternalIdsSchema,
});

export type Book = z.infer<typeof BookSchema>;

// the dates of its entries: null when nothing was read yet
const ReadDatesSchema = z.object({
	firstReadDate: z.iso.date().nullable(),
	lastReadDate: z.iso.date().nullable(),
	readingDates: z.array(z.iso.date()),
});
// A book in lists: its main edition (the one of its latest reading, else the first one) gives
// the language, pages and cover; each reading carries the language of its edition.
export const BookOverviewSchema = BookSchema.omit({ editions: true, externalIds: true })
	.extend(ReadDatesSchema.shape)
	.extend({
		language: z.string(),
		pages: z.number().int().nullable(),
		cover: z.string().nullable(),
		// the main edition, and its title when it has its own
		editionId: z.uuid().nullable(),
		editionTitle: z.string().nullable(),
		nbReadings: z.number(),
		// the details only with `withReadingsDetails`
		readings: z.array(
			ReadingSchema.partial({ details: true }).extend(ReadDatesSchema.shape).extend({ language: z.string() }),
		),
	});
export type BookOverview = z.infer<typeof BookOverviewSchema>;
export const BookListResponseSchema = z.array(BookOverviewSchema);

export const BookListRequestSchema = GenericListSchema.extend({
	withReadingsDetails: z.preprocess((val) => {
		if (val === "true") return true;
		else return false;
	}, z.boolean().default(false)),
});
export const BookDetailsParamsSchema = UUIDParamsSchema;

//
// SAVE / DELETE MODEL
//
export const SaveBookModelRequestSchema = BookModelSchema.omit({ id: true });
export type SaveBookModelRequest = z.infer<typeof SaveBookModelRequestSchema>;
export const ModelParamsRequestSchema = z.object({
	id: z.uuid(),
	modelId: z.uuid(),
});
export const ReadingParamsRequestSchema = UUIDParamsSchema;

//
// SAVE BOOK
//
// Request
export const SaveBookRequestSchema = BookSchema.omit({
	id: true,
	editions: true,
	models: true,
	authors: true,
	series: true,
	externalIds: true,
}).extend({
	authors: z.array(SaveCreditSchema).min(1),
	originalLanguage: z.union([LanguageCodeSchema, z.literal("")]),
	country: z.union([CountryCodeSchema, z.literal("")]),
	// left out = unchanged, {} = none
	externalIds: ExternalIdsSchema.optional(),
});
// Response
export const SaveBookResponseSchema = BookSchema;
export type SaveBookResponse = z.infer<typeof SaveBookResponseSchema>;

//
// SAVE EDITION
//
// `cover`: the URL given by the server = unchanged, another URL or a data URI = new cover, null = no cover
export const SaveEditionRequestSchema = EditionSchema.omit({
	id: true,
	readings: true,
	publisher: true,
	translators: true,
	externalIds: true,
}).extend({
	// an organization
	publisherId: z.uuid().nullable(),
	translators: z.array(SaveCreditSchema),
	language: LanguageCodeSchema.nullable(),
	// left out = unchanged, {} = none
	externalIds: ExternalIdsSchema.optional(),
});
export type SaveEditionRequest = z.infer<typeof SaveEditionRequestSchema>;
export const EditionParamsRequestSchema = z.object({
	id: z.uuid(),
	editionId: z.uuid(),
});

//
// SERIES: books and sub-series (series of their own, possibly in several parents), in a free order,
// each with a free label. The reading order over the whole tree ("#n") is computed.
//
export const SeriesSchema = SeriesRefSchema.extend({
	// in the whole tree
	nbBooks: z.number(),
	parents: z.array(SeriesRefSchema),
});
export type Series = z.infer<typeof SeriesSchema>;
export const SeriesListResponseSchema = z.array(SeriesSchema);
export const SeriesParamsRequestSchema = UUIDParamsSchema;

export type SeriesTreeItem =
	| { kind: "book"; positionLabel: string | null; readingOrder: number; book: BookOverview }
	| { kind: "series"; positionLabel: string | null; series: { id: string; title: string }; items: SeriesTreeItem[] };
// recursive: a sub-series holds its own items
export const SeriesTreeItemSchema: z.ZodType<SeriesTreeItem> = z.lazy(() =>
	z.discriminatedUnion("kind", [
		z.object({
			kind: z.literal("book"),
			positionLabel: z.string().nullable(),
			readingOrder: z.number(),
			book: BookOverviewSchema,
		}),
		z.object({
			kind: z.literal("series"),
			positionLabel: z.string().nullable(),
			series: SeriesRefSchema,
			items: z.array(SeriesTreeItemSchema),
		}),
	]),
);
export const SeriesDetailsSchema = SeriesRefSchema.extend({
	parents: z.array(SeriesRefSchema),
	items: z.array(SeriesTreeItemSchema),
});
export type SeriesDetails = z.infer<typeof SeriesDetailsSchema>;

// the direct items of the series, in their order (positions 1..n)
const positionLabel = z.string().trim().nonempty().nullable();
export const SaveSeriesItemSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("book"), bookId: z.uuid(), positionLabel }),
	z.object({ kind: z.literal("series"), seriesId: z.uuid(), positionLabel }),
]);
export type SaveSeriesItem = z.infer<typeof SaveSeriesItemSchema>;
export const SaveSeriesRequestSchema = z.object({
	title: z.string().trim().nonempty(),
	items: z.array(SaveSeriesItemSchema),
});
export type SaveSeriesRequest = z.infer<typeof SaveSeriesRequestSchema>;

//
// ENTITY BOOKS
//
// The books an entity is credited on, by role (a translator or a publisher through an edition), for its page in the
// directory: in publication order, only the roles it has
export const EntityBookRoleSchema = z.enum(["author", "illustrator", "preface", "translator", "publisher"]);
export type EntityBookRole = z.infer<typeof EntityBookRoleSchema>;
export const EntityBooksParamsRequestSchema = z.object({ entityId: z.uuid() });
export const EntityBooksResponseSchema = z.array(
	z.object({ role: EntityBookRoleSchema, books: z.array(BookOverviewSchema) }),
);
export type EntityBooksResponse = z.infer<typeof EntityBooksResponseSchema>;

//
// SAVE READING
//
// Request
export const SaveReadingRequestSchema = ReadingSchema;

//
// DELETE READING
//
export const DeleteReadingParamsRequestSchema = z.object({
	id: z.uuid(),
	readingId: z.uuid(),
});

//
// REPORT
//
const ItemDistributionSchema = z.object({
	name: z.string(),
	chapters: z.number(),
	percent: z.number(),
});
// Request
export const GetReportQuerystringRequestSchema = PeriodQSSchema;
// Response
export const GetReportResponseSchema = z.object({
	hasData: z.boolean(),
	streakInfo: z.object({
		days: z.number(),
		start: z.iso.date().nullable(),
		end: z.iso.date().nullable(),
	}),
	statusDistribution: z.array(
		z.object({
			name: z.string(),
			books: z.number(),
			averageDays: z.number(),
			medianDays: z.number(),
		}),
	),
	tagDistribution: z.array(ItemDistributionSchema),
	langDistribution: z.array(ItemDistributionSchema),
	authorDistribution: z.array(
		z.object({
			name: z.string(),
			books: z.number(),
			chapters: z.number(),
			days: z.number(),
		}),
	),
});
export type GetReportResponse = z.infer<typeof GetReportResponseSchema>;

//
// LOOKUP: a book or an edition found in an outside source (Open Library…), to fill in the forms.
// See .scratch/reading-book-openlibrary/spec.md
//
export const LookupSourceSchema = ExternalSourceSchema;
export type LookupSource = z.infer<typeof LookupSourceSchema>;

// An ISBN-10 or ISBN-13 without its hyphens and spaces ("978-2-07-036002-4" → "9782070360024"), else null
export function normalizeIsbn(text: string) {
	const isbn = text.replace(/[\s-]/g, "").toUpperCase();
	return /^(\d{9}[\dX]|\d{13})$/.test(isbn) ? isbn : null;
}
const IsbnSchema = z.string().transform((text, ctx) => {
	const isbn = normalizeIsbn(text);
	if (!isbn) {
		ctx.addIssue({ code: "custom", message: "not an ISBN-10 or ISBN-13" });
		return z.NEVER;
	}
	return isbn;
});

// a person or an organization named by the source; entityId: the single entity of that name
const LookupNameSchema = z.object({ name: z.string(), entityId: z.uuid().nullable() });

export const LookupWorkSchema = z.object({
	source: LookupSourceSchema,
	externalId: z.string(),
	title: z.string(),
	authors: z.array(LookupNameSchema),
	originalYear: z.number().int().nullable(),
	// a thumbnail for the results list
	cover: z.url().nullable(),
});
export type LookupWork = z.infer<typeof LookupWorkSchema>;
export const LookupWorkListSchema = z.array(LookupWorkSchema);

export const LookupEditionSchema = z.object({
	source: LookupSourceSchema,
	externalId: z.string(),
	workExternalId: z.string().nullable(),
	title: z.string().nullable(),
	publisher: LookupNameSchema.nullable(),
	collection: z.string().nullable(),
	language: LanguageCodeSchema.nullable(),
	pages: z.number().int().nullable(),
	type: EditionTypeSchema.nullable(),
	isbn: z.string().nullable(),
	year: z.number().int().nullable(),
	// given as the edition's cover URL
	cover: z.url().nullable(),
});
export type LookupEdition = z.infer<typeof LookupEditionSchema>;
export const LookupEditionListSchema = z.array(LookupEditionSchema);

export const LookupSourceParamsSchema = z.object({ source: LookupSourceSchema });
export const LookupWorkParamsSchema = LookupSourceParamsSchema.extend({ externalId: z.string().trim().nonempty() });
// by ISBN (the work of that edition), else by title and author
export const LookupWorksQuerySchema = z.union([
	z.object({ isbn: IsbnSchema }),
	z.object({ title: z.string().trim().nonempty(), author: z.string().trim().nonempty().optional() }),
]);
export type LookupWorksQuery = z.infer<typeof LookupWorksQuerySchema>;
export const LookupWorkEditionsQuerySchema = z.object({ language: LanguageCodeSchema.optional() });
export const LookupEditionQuerySchema = z.object({ isbn: IsbnSchema });
