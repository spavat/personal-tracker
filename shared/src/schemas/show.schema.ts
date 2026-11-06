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
	// main photo: one of the artist's media
	pictureId: z.uuid().nullable().optional(),
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
	status: z.string().nullish(),
	order: z.number(),
	// portrait for this role: one of the artist's media
	pictureId: z.uuid().nullable().optional(),
});

export const PerformanceSchema = z.object({
	id: z.int(),
	date: z.iso.datetime({ local: true }),
	canceled: z.boolean(),
	seat: z.string().max(45),
	placeId: z.int().nullish(),
	spectacleId: z.int(),
	casting_status: z.enum(["tbd", "unknown", "partial", "complete"]).default("tbd"),
	casting_origin: z.enum(["na", "program", "performance"]).default("na"),
	// one of the spectacle's media of kind poster
	posterId: z.uuid().nullable().optional(),
});
export type Performance = z.infer<typeof PerformanceSchema>;

export const RoleModelSchema = z.object({
	id: z.int(),
	name: z.string(),
	main: z.boolean(),
	artistId: z.number().optional().nullable(),
	order: z.number(),
	// portrait for this role: one of the artist's media, copied to the performance roles
	pictureId: z.uuid().nullable().optional(),
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

export const SpectacleLinkSchema = z.object({
	label: z.string().max(100).nonempty(),
	url: z.url(),
});
export type SpectacleLink = z.infer<typeof SpectacleLinkSchema>;

export const SpectacleSchema = z.object({
	id: z.int(),
	name: z.string().max(100).nonempty(),
	workId: z.int(),
	description: z.string().nullable().optional(),
	descriptionSource: z.url().nullable().optional(),
	links: z.array(SpectacleLinkSchema).optional(),
	// markdown
	tracklist: z.string().nullable().optional(),
	models: z.array(ModelSchema).optional(),
});
export type Spectacle = z.infer<typeof SpectacleSchema>;

//
// VIEWS (read shapes: an entity looks the same in every response)
//
// name already resolved at the performance date
export const PlaceRefSchema = PlaceSchema.pick({ id: true, name: true, country: true });
export const SpectacleRefSchema = SpectacleSchema.pick({ id: true, name: true });
export const ArtistRefSchema = ArtistSchema.pick({ id: true, name: true });
export type ArtistRef = z.infer<typeof ArtistRefSchema>;

export const ArtistViewSchema = ArtistSchema.extend({
	pictureUrl: z.string().nullable(),
});
export type ArtistView = z.infer<typeof ArtistViewSchema>;

export const RoleViewSchema = RoleSchema.omit({ artistId: true }).extend({
	artist: ArtistRefSchema,
	pictureUrl: z.string().nullable(),
});
export type RoleView = z.infer<typeof RoleViewSchema>;

export const PerformanceViewSchema = PerformanceSchema.omit({ placeId: true, spectacleId: true }).extend({
	posterUrl: z.string().nullable(),
	place: PlaceRefSchema.nullable(),
	spectacle: SpectacleRefSchema,
	// present when the endpoint loads the cast
	roles: z.array(RoleViewSchema).optional(),
});
export type PerformanceView = z.infer<typeof PerformanceViewSchema>;

// a model role may have no artist yet
export const ModelRoleViewSchema = RoleModelSchema.omit({ artistId: true }).extend({
	artist: ArtistRefSchema.nullable(),
});
export type ModelRoleView = z.infer<typeof ModelRoleViewSchema>;

export const ModelViewSchema = ModelSchema.omit({ spectacleId: true }).extend({
	roles: z.array(ModelRoleViewSchema),
});
export type ModelView = z.infer<typeof ModelViewSchema>;

//
// PERFORMANCE LIST
//
// Request
export const PerformanceListQuerystringRequestSchema = OptionalPeriodQSSchema.extend(SortQSSchema.shape);

//
// PERFORMANCE DETAILS
//
// Request
export const PerformanceDetailsParamsRequestSchema = z.object({
	performanceId: z.coerce.number(),
});
// Response
export const PerformanceDetailsResponseSchema = PerformanceViewSchema.extend({
	spectacle: SpectacleSchema.omit({ models: true }).extend({ models: z.array(ModelViewSchema) }),
});
export type PerformanceDetailsResponse = z.infer<typeof PerformanceDetailsResponseSchema>;

//
// PERFORMANCE: DELETE
//
export const DeletePerformanceParamsRequestSchema = NumberIdParamsSchema;

type ItemOverview = {
	nbPerformances: number;
	nbSpectacles: number;
};

export type ArtistListResponse = ArtistView & ItemOverview;

export type PlaceListResponse = Place & ItemOverview;

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
export const ArtistDetailsResponseSchema = ArtistViewSchema.extend({
	media: z.array(z.lazy(() => ArtistMediaSchema)),
	groups: z.array(
		SpectacleSchema.extend({
			// with the role played by the artist
			performances: z.array(PerformanceViewSchema.extend({ role: z.string() })),
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
			performances: z.array(PerformanceViewSchema),
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
// Response
export const SavePlaceResponseSchema = PlaceSchema.extend({
	formerNames: z.array(PlaceFormerNameSchema),
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
// Response (without the roles: the front reloads the model)
export const SaveModelResponseSchema = ModelSchema.omit({ roles: true });

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
// Response
export const SpectacleDetailsResponseSchema = SpectacleSchema.omit({ models: true }).extend({
	performances: z.array(PerformanceViewSchema),
	models: z.array(ModelViewSchema),
	media: z.array(z.lazy(() => SpectacleMediaSchema)),
});
export type SpectacleDetailsResponse = z.infer<typeof SpectacleDetailsResponseSchema>;

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
		performance: PerformanceSchema.partial({
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
// Response
export const SavePerformanceResponseSchema = PerformanceSchema;

//
// MEDIA
//
export const SpectacleMediaKindSchema = z.enum(["poster", "photo", "programme", "recording"]);
export type SpectacleMediaKind = z.infer<typeof SpectacleMediaKindSchema>;
export const MediaSchema = z.object({
	id: z.uuid(),
	label: z.string(),
	contentType: z.string(),
	url: z.string(),
});
export type Media = z.infer<typeof MediaSchema>;
export const SpectacleMediaSchema = MediaSchema.extend({
	kind: SpectacleMediaKindSchema,
});
export type SpectacleMedia = z.infer<typeof SpectacleMediaSchema>;
export const ArtistMediaSchema = MediaSchema.extend({
	spectacleId: z.number().nullable(),
});
export type ArtistMedia = z.infer<typeof ArtistMediaSchema>;
// Request
export const SpectacleMediaParamsRequestSchema = z.object({
	spectacleId: z.coerce.number(),
});
export const SpectacleMediaIdParamsRequestSchema = SpectacleMediaParamsRequestSchema.extend({
	mediaId: z.uuid(),
});
export const ArtistMediaParamsRequestSchema = z.object({
	artistId: z.coerce.number(),
});
export const ArtistMediaIdParamsRequestSchema = ArtistMediaParamsRequestSchema.extend({
	mediaId: z.uuid(),
});
export const SpectacleMediaListQuerystringRequestSchema = z.object({
	kind: SpectacleMediaKindSchema.optional(),
});
const MediaFieldsSchema = z.object({
	label: z.string().max(100).default(""),
	// only for artist media: the spectacle the portrait was taken for
	spectacleId: z.number().nullable().optional(),
});
// source: data URI or remote URL of an image (stored as AVIF) or a PDF (stored as-is)
export const UploadMediaBodyRequestSchema = MediaFieldsSchema.extend({
	source: z.string().min(1),
	// only for spectacle media; recordings go through a signed direct upload (not available yet)
	kind: SpectacleMediaKindSchema.exclude(["recording"]).default("poster"),
});
export type UploadMediaBodyRequest = z.infer<typeof UploadMediaBodyRequestSchema>;
export const UpdateMediaBodyRequestSchema = MediaFieldsSchema;
export type UpdateMediaBodyRequest = z.infer<typeof UpdateMediaBodyRequestSchema>;
// every media of the owner, in the new order
export const ReorderMediaBodyRequestSchema = z.object({
	mediaIds: z.array(z.uuid()),
});
export type ReorderMediaBodyRequest = z.infer<typeof ReorderMediaBodyRequestSchema>;

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
