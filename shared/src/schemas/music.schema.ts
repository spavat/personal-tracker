import * as z from "zod";

import { OptionalPeriodQSSchema, PeriodQSSchema, SearchQSSchema, UUIDParamsSchema } from "./common.schema";

export const MusicArtistItemSchema = z.string().nonempty();

export const MusicListeningSchema = z.object({
	id: z.uuidv4(),
	listeningDate: z.iso.date(),
	artist: z.array(MusicArtistItemSchema).min(1),
	album: z.string(),
	releaseDate: z.string(),
	duration: z.number(),
	genre: z.string(),
	contextTags: z.array(z.string()).optional(),
	compilation: z.boolean().optional(),
});

export const MusicGenreSchema = z.object({
	id: z.uuidv4(),
	name: z.string(),
	genres: z.array(z.string()),
});

export type MusicListening = z.infer<typeof MusicListeningSchema>;
export type MusicGenre = z.infer<typeof MusicGenreSchema>;

export const MusicGenresResponse = z.array(MusicGenreSchema);

//
// GENRE SAVE
//
export const SaveGenreRequestSchema = MusicGenreSchema.partial({ id: true });

//
// GENRE DELETE
//
// Request
export const DeleteGenreParamsRequestSchema = UUIDParamsSchema;

//
// LIST
//
// Request
export const ListQuerystringRequestSchema = OptionalPeriodQSSchema;
// Response
export const ListResponseSchema = z.array(MusicListeningSchema);

//
// SEARCH
//
// Request
export const SearchQuerystringRequestSchema = SearchQSSchema;
// Response
export const SearchResponseSchema = z.array(MusicListeningSchema);

//
// DETAILS
//
// Request
export const DetailsQuerystringRequestSchema = UUIDParamsSchema;
// Response
export const DetailsResponseSchema = MusicListeningSchema;

//
// SAVE
//
export const SaveBodyRequestSchema = MusicListeningSchema.partial({ id: true });

//
// DELETE
//
// Request
export const DeleteParamsRequestSchema = UUIDParamsSchema;
// Response
export type DeleteParamsRequest = z.infer<typeof DeleteParamsRequestSchema>;

//
// STATS
//
const ItemStatsSchema = z.object({
	name: z.string(),
	key: z.string(),
	duration: z.number(),
	details: z.array(
		z.object({
			name: z.string(),
			key: z.string(),
			duration: z.number(),
			count: z.number(),
		}),
	),
});
// Request
export const StatsQuerystringRequestSchema = OptionalPeriodQSSchema.required({ from: true, to: true });

// Response
export const StatsResponseSchema = z.object({
	monthsDistribution: z.array(ItemStatsSchema),
	genresDistribution: z.array(ItemStatsSchema),
	releaseYearsDistribution: z.array(ItemStatsSchema),
	totalDuration: z.number(),
	nbListenings: z.number(),
	nbDays: z.number(),
	averageDurationPerDay: z.number(),
	inProgress: z.boolean(),
});
export type StatsResponse = z.infer<typeof StatsResponseSchema>;

//
// FORTNIGHT STATS
//
// Response
export const FortnightStatsResponseSchema = z.array(
	z.object({
		date: z.iso.date(),
		duration: z.number(),
	}),
);
export type FortnightStatsRespons = z.infer<typeof FortnightStatsResponseSchema>;

//
// REPORT
//
const ArtistItem = z.object({
	name: z.string(),
	duration: z.number(),
});
// Request
export const GetReportQuerystringRequestSchema = PeriodQSSchema;
// Response
export const GetReportResponseSchema = z.object({
	hasData: z.boolean(),
	stats: z.object({
		averageDurationByDay: z.number(),
		totalDuration: z.number(),
		artistsCount: z.number(),
		albumsCount: z.number(),
		uniqueDaysCount: z.number(),
		periodDaysCount: z.number(),
	}),
	artists: z.array(ArtistItem),
	genres: z.array(
		z.object({
			name: z.string(),
			duration: z.number(),
			artists: z.array(ArtistItem),
		}),
	),
});
export type GetReportResponse = z.infer<typeof GetReportResponseSchema>;
