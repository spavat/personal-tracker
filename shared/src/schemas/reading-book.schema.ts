import * as z from "zod";

import { GenericListSchema, PeriodQSSchema, UUIDParamsSchema } from "./common.schema";
import { EntityKindSchema } from "./entity.schema";

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
	language: z.string().nullable(),
	pages: z.number().int().nullable(),
	type: EditionTypeSchema.nullable(),
	isbn: z.string().nullable(),
	year: z.number().int().nullable(),
	// served through /images/reading-book/edition/:id
	cover: z.string().nullable(),
	// the chapters its readings follow
	modelId: z.uuid().nullable(),
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
	originalLanguage: z.string(),
	originalYear: z.number().int().nullable(),
	country: z.string(),
	models: z.array(BookModelSchema),
	editions: z.array(EditionSchema),
	series: z.array(BookSeriesSchema),
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
export const BookOverviewSchema = BookSchema.omit({ editions: true })
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
export const SaveBookModelRequestSchema = BookModelSchema.partial({ id: true });
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
export const SaveBookRequestSchema = BookSchema.partial({ id: true })
	.omit({ editions: true, models: true, authors: true, series: true })
	.extend({ authors: z.array(SaveCreditSchema).min(1) });
// Response
export const SaveBookResponseSchema = BookSchema;
export type SaveBookResponse = z.infer<typeof SaveBookResponseSchema>;

//
// SAVE EDITION
//
// `cover`: the URL given by the server = unchanged, another URL or a data URI = new cover, null = no cover
export const SaveEditionRequestSchema = EditionSchema.partial({ id: true })
	.omit({ readings: true, publisher: true, translators: true })
	.extend({
		// an organization
		publisherId: z.uuid().nullable(),
		translators: z.array(SaveCreditSchema),
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
	id: z.uuid().optional(),
	title: z.string().trim().nonempty(),
	items: z.array(SaveSeriesItemSchema),
});
export type SaveSeriesRequest = z.infer<typeof SaveSeriesRequestSchema>;

//
// AUTHORS (the people credited as author of a book)
//
export const AuthorSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	sortName: z.string().nullable(),
	// the portrait of the entity
	picture: z.string().nullable(),
	nbBooks: z.number(),
	nbReadings: z.number(),
});
export type Author = z.infer<typeof AuthorSchema>;
export const AuthorListResponseSchema = z.array(AuthorSchema);
export const AuthorParamsRequestSchema = UUIDParamsSchema;
export const AuthorDetailsSchema = AuthorSchema.omit({ nbBooks: true, nbReadings: true }).extend({
	kind: EntityKindSchema,
	books: z.array(BookOverviewSchema),
});
export type AuthorDetails = z.infer<typeof AuthorDetailsSchema>;

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
