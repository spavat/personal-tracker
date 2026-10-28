import * as z from "zod";

import { GenericListSchema, UUIDParamsSchema } from "./common.schema";

// ENUMERATIONS
const statuses = ["in-progress", "complete", "abandoned"] as const;
export const StatusEnumSchema = z.enum(statuses);
export type StatusEnum = z.infer<typeof StatusEnumSchema>;

const origins = ["Livre", "Digital", "MangaPlus", "Manga-Nova", "Scantrad"] as const;
export const OriginEnumSchema = z.enum(origins);
export type OriginEnum = z.infer<typeof OriginEnumSchema>;

const types = ["volume", "chapter"] as const;
export const TypeEnumSchema = z.enum(types);
export type TypeEnum = z.infer<typeof TypeEnumSchema>;

const mangaTypes = ["Shonen", "Seinen", "Shojo", "Josei", "Kodomo", "Hentai"] as const;
export const MangaTypeEnumSchema = z.enum(mangaTypes);
export type MangaTypeEnum = z.infer<typeof MangaTypeEnumSchema>;

// BUSINESS OBJECTS
export const ReadingSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	title: z.string().optional(),
	language: z.string(),
	origin: OriginEnumSchema,
	type: TypeEnumSchema,
	date: z.iso.date(),
	edition: z.string().optional(),
	contextTags: z.array(z.string()).optional(),
	created: z.iso.datetime({ local: true }).optional(),
});
export type Reading = z.infer<typeof ReadingSchema>;

export const MangaSchema = z.object({
	id: z.uuidv4(),
	title: z.string().nonempty(),
	titleEnglish: z.string().optional(),
	author: z.array(z.string().nonempty()).optional(),
	art: z.array(z.string().nonempty()).optional(),
	scenario: z.array(z.string().nonempty()).optional(),
	type: MangaTypeEnumSchema.optional(),
	genres: z.array(z.string()).optional(),
	readings: z.array(ReadingSchema),
	status: StatusEnumSchema,
	links: z
		.array(
			z.object({
				name: z.string(),
				url: z.url(),
			}),
		)
		.optional(),
});

export type Manga = z.infer<typeof MangaSchema>;

// ENDPOINT SCHEMAS
export const MangaOverviewSchema = MangaSchema.extend({
	firstReadingDate: z.iso.date(),
	lastReadingDate: z.iso.date(),
	latestReadingCreated: z.iso.datetime({ local: true }),
}).partial({
	readings: true,
});
export type MangaOverview = z.infer<typeof MangaOverviewSchema>;
export const ListMangaOverviewResponse = z.array(MangaOverviewSchema);
export type ListMangaOverview = z.infer<typeof ListMangaOverviewResponse>;

export const MangaListRequestSchema = GenericListSchema.extend({
	withReadings: z.preprocess((val) => {
		if (val === "true") return true;
		else return false;
	}, z.boolean().default(false)),
});
export const MangaDetailsParamsSchema = UUIDParamsSchema;
//
// SAVE
//
// Request
export const SaveMangaBodyRequestSchema = MangaSchema.partial({ id: true }).omit({ readings: true });
export const SaveReadingBodyRequestSchema = ReadingSchema.partial({ id: true });

export const SaveBodyRequestSchema = z
	.object({
		manga: SaveMangaBodyRequestSchema.optional(),
		reading: SaveReadingBodyRequestSchema.optional(),
		mangaId: z.uuid().optional(),
	})
	.refine(({ manga, reading, mangaId }) => {
		if (manga && !mangaId) {
			return true; // Add manga (with or without reading)
		}

		if (reading && mangaId) {
			return true; // Add reading only
		}
		return false;
	});
export type SaveBodyRequestType = z.infer<typeof SaveBodyRequestSchema>;
export const SaveParamsRequestSchema = UUIDParamsSchema;

// Response
export const SaveResponseSchema = MangaSchema;
export type SaveResponse = z.infer<typeof SaveResponseSchema>;
