import * as z from "zod";

import {
	NumberIdParamsSchema,
	OptionalPeriodQSSchema,
	PeriodQSSchema,
	SearchQSSchema,
	SortQSSchema,
} from "./common.schema";

//
// COMMON
//
export const GroupedByYearRequestSchema = z.object({
	groupByYear: z.preprocess((val) => {
		if (val === "true") return true;
		else return false;
	}, z.boolean().default(false)),
});
export const GroupedBySpectacleRequestSchema = z.object({
	groupBySpectacle: z.preprocess((val) => {
		if (val === "true") return true;
		else return false;
	}, z.boolean().default(false)),
});

//
// OBJECTS
//
export const ArtistSchema = z.object({
	id: z.int(),
	name: z.string().max(100).nonempty(),
});
export type Artist = z.infer<typeof ArtistSchema>;

export const PlaceSchema = z.object({
	id: z.int(),
	name: z.string().max(100).nonempty(),
	address: z.string(),
	country: z.string(),
	// An empty field of the form means no link
	link: z
		.url()
		.optional()
		.nullable()
		.or(z.literal("").transform(() => null)),
});
export type Place = z.infer<typeof PlaceSchema>;

// Name used before untilDate (exclusive, from 00:00)
export const PlaceFormerNameSchema = z.object({
	name: z.string().max(100).nonempty(),
	untilDate: z.iso.date(),
});
export type PlaceFormerName = z.infer<typeof PlaceFormerNameSchema>;

export const RoleSchema = z.object({
	id: z.int(),
	name: z.string(),
	main: z.boolean(),
	artistId: z.number().positive(),
	artistName: z.string().optional(),
	status: z.string().optional(),
	order: z.number(),
});

export const PerformanceSchema = z.object({
	id: z.int(),
	date: z.iso.datetime({ local: true }),
	canceled: z.boolean(),
	seat: z.string().max(45),
	placeId: z.int().optional(),
	place: PlaceSchema.optional(),
	spectacleId: z.int(),
	casting_status: z.enum(["tbd", "unknown", "partial", "complete"]).default("tbd"),
	casting_origin: z.enum(["na", "program", "performance"]).default("na"),
	roles: z.array(RoleSchema),
});
export type Performance = z.infer<typeof PerformanceSchema>;

export const RoleModelSchema = z.object({
	id: z.int(),
	name: z.string(),
	main: z.boolean(),
	artistId: z.number().optional().nullable(),
	order: z.number(),
});
export const ModelSchema = z.object({
	id: z.int(),
	name: z.string().max(100).nonempty(),
	spectacleId: z.int(),
	roles: z.array(RoleModelSchema),
});
export type Model = z.infer<typeof ModelSchema>;

export const WorkSchema = z.object({
	id: z.int(),
	name: z.string().max(100).nonempty(),
});

export const SpectacleSchema = z.object({
	id: z.int(),
	name: z.string().max(100).nonempty(),
	workId: z.int(),
	models: z.array(ModelSchema).optional(),
});
export type Spectacle = z.infer<typeof SpectacleSchema>;

//
// PERFORMANCE LIST
//
// Request
export const PerformanceListQuerystringRequestSchema = OptionalPeriodQSSchema;

export type PerformanceListResponse = Performance & {
	spectacle: string;
	place: string;
	country: string;
	hasCasting: boolean;
};

//
// PERFORMANCE DETAILS
//
// Request
export const PerformanceDetailsParamsRequestSchema = z.object({
	performanceId: z.coerce.number(),
});
// Response
export const PerformanceDetailsResponseSchema = PerformanceSchema.extend({
	spectacle: SpectacleSchema,
});
export type PerformanceDetailsResponse = z.infer<typeof PerformanceDetailsResponseSchema>;

type ItemOverview = {
	nbPerformances: number;
	nbSpectacles: number;
};

export type ArtistListResponse = Artist & ItemOverview;

export type PlaceListResponse = Place & ItemOverview;

type ItemDetails = {
	id: number;
	date: string;
	canceled: boolean;
	seat: string;
	role?: string;
	placeId: number;
	placeName: string;
	placeCountry: string;
	spectacleId: number;
	spectacleName: string;
};

const ItemDetailsSchema = z.object({
	id: z.number(),
	date: z.string(),
	canceled: z.boolean(),
	seat: z.string(),
	role: z.string().optional(),
	placeId: z.number(),
	placeName: z.string(),
	placeCountry: z.string(),
	spectacleId: z.number(),
	spectacleName: z.string(),
});

type ItemGroup = Spectacle & {
	performances: Array<ItemDetails>;
};
export type ItemDetailsResponse<T> = T & {
	groups: Array<ItemGroup>;
};

const StatsArtistPlaceSchema = z.object({
	nbSpectacles: z.number(),
	nbPerformances: z.number(),
	lastPerformance: z.iso.date(),
});

//
// ARTIST: LIST
//
// Request
export const ArtistListQuerystringRequestSchema = SortQSSchema;

//
// ARTIST: DETAILS
//
// Request
export const ArtistDetailsParamsRequestSchema = NumberIdParamsSchema;
export const ArtistDetailsQuerystringRequestSchema = GroupedBySpectacleRequestSchema;
// Response
export const ArtistDetailsResponseSchema = ArtistSchema.extend({
	groups: z.array(
		SpectacleSchema.extend({
			performances: z.array(ItemDetailsSchema),
		}),
	),
	stats: StatsArtistPlaceSchema,
});
export type ArtistDetailsResponse = z.infer<typeof ArtistDetailsResponseSchema>;

//
// ARTIST: SAVE
//
// Request
export const SaveArtistBodyRequestSchema = ArtistSchema.partial({ id: true });
export type SaveArtistBodyRequest = z.infer<typeof SaveArtistBodyRequestSchema>;

//
// ARTIST: DELETE
//
export const DeleteArtistParamsRequestSchema = NumberIdParamsSchema;

//
// PLACE: LIST
//
// Request
export const PlaceListQuerystringRequestSchema = SortQSSchema;

//
// PLACE: DETAILS
//
// Request
export const PlaceDetailsParamsRequestSchema = NumberIdParamsSchema;
export const PlaceDetailsQuerystringRequestSchema = GroupedBySpectacleRequestSchema;
// Response
export const PlaceDetailsResponseSchema = PlaceSchema.extend({
	formerNames: z.array(PlaceFormerNameSchema),
	groups: z.array(
		SpectacleSchema.extend({
			performances: z.array(ItemDetailsSchema),
		}),
	),
	stats: StatsArtistPlaceSchema,
});
export type PlaceDetailsResponse = z.infer<typeof PlaceDetailsResponseSchema>;

//
// PLACE: SAVE
//
// Request
export const SavePlaceBodyRequestSchema = PlaceSchema.partial({ id: true }).extend({
	formerNames: z
		.array(PlaceFormerNameSchema)
		.refine((names) => new Set(names.map((n) => n.untilDate)).size === names.length, {
			message: "Two former names cannot end on the same date",
		}),
});

//
// PLACE: DELETE
//
export const DeletePlaceParamsRequestSchema = NumberIdParamsSchema;

//
// MODEL: DETAILS
//
// Request
export const ModelDetailsParamsRequestSchema = NumberIdParamsSchema;
// Response
export const ModelDetailsResponseSchema = ModelSchema.extend({
	spectacle: SpectacleSchema,
});
export type ModelDetailsResponse = z.infer<typeof ModelDetailsResponseSchema>;
//
// MODEL: SAVE
//
// Request
export const SaveModelBodyRequestSchema = ModelSchema.partial({ id: true }).extend({
	roles: z
		.array(
			RoleModelSchema.partial({ id: true }).extend({
				artist: z.string().optional(),
			}),
		)
		.nonempty(),
});
export type SaveModelBodyRequest = z.infer<typeof SaveModelBodyRequestSchema>;

//
// MODEL: DELETE
//
export const DeleteModelParamsRequestSchema = NumberIdParamsSchema;

//
// CASTING
//
export const SaveCastingBodyRequestSchema = z.object({
	performanceId: z.number(),
	roles: z.array(RoleSchema.partial({ id: true })),
});
export type SaveCastingBodyRequest = z.infer<typeof SaveCastingBodyRequestSchema>;

//
// WORK: LIST
//
// Response
export const WorkListResponseSchema = z.array(WorkSchema);
export type WorkListResponse = z.infer<typeof WorkListResponseSchema>;

//
// WORK: GROUPED LIST
//
// Request
export const WorkGroupedListRequestSchema = GroupedByYearRequestSchema;
export type WorkGroupedListRequest = z.infer<typeof WorkGroupedListRequestSchema>;

//
// WORK: DETAILS
//
// Request
export const WorkDetailsParamsRequestSchema = NumberIdParamsSchema;
// Response
export const WorkDetailsResponseSchema = WorkSchema.extend({
	spectacles: z.array(SpectacleSchema),
});
export type WorkDetailsResponse = z.infer<typeof WorkDetailsResponseSchema>;

//
// WORK: SAVE
//
// Request
export const SaveWorkBodyRequestSchema = WorkSchema.partial({ id: true });
//
// WORK: DELETE
//
export const DeleteWorkParamsRequestSchema = NumberIdParamsSchema;

//
// SPECTACLE: LIST
//
// Response
export const SpectacleListResponseSchema = z.array(SpectacleSchema);
export type SpectacleListResponse = z.infer<typeof SpectacleListResponseSchema>;

//
// SPECTACLE: GROUPED LIST
//
// Request
export const SpectacleGroupedListRequestSchema = GroupedByYearRequestSchema;
export type SpectacleGroupedListRequest = z.infer<typeof SpectacleGroupedListRequestSchema>;

//
// SPECTACLE: DETAILS
//
// Request
export const SpectacleDetailsParamsRequestSchema = NumberIdParamsSchema;

//
// SPECTACLE: SAVE
//
// Request
export const SaveSpectacleBodyRequestSchema = SpectacleSchema.partial({ id: true });

//
// PERFORMANCE: SAVE
//
export const SavePerformanceBodyRequestSchema = z
	.object({
		work: WorkSchema.partial({ id: true }).optional(),
		spectacle: SpectacleSchema.partial({ id: true, workId: true }).optional(),
		place: PlaceSchema.partial({ id: true }).optional(),
		performance: PerformanceSchema.omit({ roles: true }).partial({
			id: true,
			placeId: true,
			spectacleId: true,
		}),
	})
	.refine(
		({ spectacle, performance }) => {
			// needs a spectacle
			if (!performance.spectacleId && !spectacle?.name) {
				return false;
			}
			return true;
		},
		{
			message: "The performance needs a spectacle (performance.spectacleId or spectacle.name)",
			path: ["performance", "spectacleId"],
		},
	)
	.refine(
		({ spectacle, work, performance }) => {
			// a new spectacle needs a work
			if (!performance.spectacleId && !spectacle?.workId && !work?.name) {
				return false;
			}
			return true;
		},
		{
			message: "A new spectacle needs a work (spectacle.workId or work.name)",
			path: ["spectacle", "workId"],
		},
	)

	.refine(
		({ place, performance }) => {
			// needs a place
			if (!performance.placeId && !place?.name) {
				return false;
			}
			return true;
		},
		{
			message: "The performance needs a place (performance.placeId or place.name)",
			path: ["performance", "placeId"],
		},
	);
export type SavePerformanceBodyRequest = z.infer<typeof SavePerformanceBodyRequestSchema>;

//
// SEARCH
//
// Request
export const SearchQuerystringRequestSchema = SearchQSSchema;

//
// REPORT
//
// Request
export const GetReportQuerystringRequestSchema = PeriodQSSchema;
// Response
export const GetReportResponseSchema = z.object({
	hasData: z.boolean(),
	stats: z.object({
		spectacles: z.number(),
		performances: z.number(),
		newSpectacles: z.number(),
		countryDistribution: z.array(
			z.object({
				code: z.string(),
				count: z.number(),
			}),
		),
	}),
	periodList: z.array(
		z.object({
			id: z.number(),
			rank: z.number(),
			name: z.string(),
			isNew: z.boolean(),
			count: z.number(),
		}),
	),
	totalList: z.array(
		z.object({
			id: z.number(),
			rank: z.number(),
			move: z.enum(["up", "down", ""]),
			name: z.string(),
			count: z.number(),
			added: z.number(),
			isNew: z.boolean(),
		}),
	),
});
export type GetReportResponse = z.infer<typeof GetReportResponseSchema>;
