import * as z from "zod";

import { GenericListSchema, PeriodQSSchema, UUIDParamsSchema } from "./common.schema";

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

export const ModelSchema = z.array(ReadingModelItemSchema);

export const BookSchema = z.object({
	id: z.uuidv4(),
	book: z.string().nonempty(),
	author: z.array(z.string().nonempty()).min(1),
	language: z.string(),
	country: z.string(),
	pages: z.number().nullable(),
	model: z.array(ReadingModelItemSchema),
	readings: z.array(ReadingSchema),
});

export type Book = z.infer<typeof BookSchema>;

type ComputedBookProps = {
	firstReadDate: string;
	lastReadDate: string;
	readingDates: Array<string>;
};
const ReadingWithOptionalDetailsSchema = ReadingSchema.partial({ details: true });
export type BookOverview = Omit<Book, "readings"> &
	ComputedBookProps & {
		nbReadings: number;
		readings: Array<z.infer<typeof ReadingWithOptionalDetailsSchema> & ComputedBookProps>;
	};

export const BookListRequestSchema = GenericListSchema.extend({
	withReadingsDetails: z.preprocess((val) => {
		if (val === "true") return true;
		else return false;
	}, z.boolean().default(false)),
});
export const BookDetailsParamsSchema = UUIDParamsSchema;

export const SaveModelBodyRequestSchema = z.array(ReadingModelItemSchema);
export const ReadingParamsRequestSchema = UUIDParamsSchema;

//
// SAVE BOOK
//
// Request
export const SaveBookRequestSchema = BookSchema.partial({ id: true }).omit({ readings: true, model: true });
// Response
export const SaveBookResponseSchema = BookSchema;
export type SaveBookResponse = z.infer<typeof SaveBookResponseSchema>;

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
