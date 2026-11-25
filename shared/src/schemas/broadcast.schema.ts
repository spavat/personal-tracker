import * as z from "zod";

import { OptionalPeriodQSSchema, PeriodQSSchema, SearchQSSchema, SortQSSchema } from "./common.schema";
import { EntityKindSchema } from "./entity.schema";

//
// ENUMERATIONS
//
const refIds = ["youtubeChannelId", "youtubePlaylistId", "rss"] as const;
export const RefIdsEnumSchema = z.enum(refIds);
export type RefIdsEnum = z.infer<typeof RefIdsEnumSchema>;
// catalog = every release is stored (imported from the source), feed = only the episodes viewed
export const TrackingSchema = z.enum(["catalog", "feed"]);
export type Tracking = z.infer<typeof TrackingSchema>;
// planned = on the watchlist (a rewatch when it has views), skipped = not to watch; a view clears it
export const EpisodeStatusSchema = z.enum(["planned", "skipped"]);
export type EpisodeStatus = z.infer<typeof EpisodeStatusSchema>;

//
// OBJECTS
//
// One listening / watching of an episode
export const ViewSchema = z.object({
	id: z.uuid(),
	date: z.iso.date(),
	// minutes watched, when not the whole episode
	duration: z.number().optional(),
	contextTags: z.array(z.string()).optional(),
	comment: z.string().optional(),
	created: z.iso.datetime({ local: true }).optional(),
});
// A person, group or organization credited on a program or an episode (core entity), in credit order
export const ProgramCreditRoleSchema = z.enum(["host", "producer", "network"]);
export type ProgramCreditRole = z.infer<typeof ProgramCreditRoleSchema>;
export const EpisodeCreditRoleSchema = z.enum(["host", "guest", "interviewee"]);
export type EpisodeCreditRole = z.infer<typeof EpisodeCreditRoleSchema>;
const creditSchema = <R extends z.ZodType>(role: R) =>
	z.object({
		entityId: z.uuid(),
		name: z.string(),
		kind: EntityKindSchema,
		role,
		// the name given on this program / episode, when it differs from the entity's
		creditedAs: z.string().nullable(),
	});
const saveCreditSchema = <R extends z.ZodType>(role: R) =>
	z.object({
		entityId: z.uuid(),
		role,
		creditedAs: z.string().trim().nonempty().nullable(),
	});
export const ProgramCreditSchema = creditSchema(ProgramCreditRoleSchema);
export type ProgramCredit = z.infer<typeof ProgramCreditSchema>;
export const EpisodeCreditSchema = creditSchema(EpisodeCreditRoleSchema);
export type EpisodeCredit = z.infer<typeof EpisodeCreditSchema>;
export const SaveProgramCreditSchema = saveCreditSchema(ProgramCreditRoleSchema);
export const SaveEpisodeCreditSchema = saveCreditSchema(EpisodeCreditRoleSchema);
// The name shown for a credit
export const creditName = (credit: { name: string; creditedAs: string | null }) => credit.creditedAs ?? credit.name;

// Time grouping of a program's episodes ("Saison 2"), in order
export const SeasonSchema = z.object({
	id: z.uuid(),
	position: z.number(),
	label: z.string(),
});
export type Season = z.infer<typeof SeasonSchema>;
// Kind grouping ("Vlog", "Review"), in display order; `match`: a title regex pre-selecting it (case ignored)
export const FormatSchema = z.object({
	id: z.uuid(),
	position: z.number(),
	label: z.string(),
	match: z.string().nullable(),
});
export type Format = z.infer<typeof FormatSchema>;

// The first format (in order) whose match rule matches the title
export function matchFormat(formats: Array<Pick<Format, "id" | "position" | "match">>, title: string) {
	return formats
		.toSorted((a, b) => a.position - b.position)
		.find(({ match }) => {
			if (!match) return false;
			try {
				return new RegExp(match, "i").test(title);
			} catch {
				return false;
			}
		});
}

const isRegex = (value: string) => {
	try {
		new RegExp(value);
		return true;
	} catch {
		return false;
	}
};

// A release of a program, with its views (oldest first)
export const EpisodeSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	shortName: z.string().optional(),
	duration: z.number(),
	type: z.string(),
	// unknown for the episodes saved before the catalogs
	releaseDate: z.iso.date().optional(),
	link: z.url().optional().or(z.literal("")),
	// plain text
	description: z.string().optional(),
	// Answered: the proxy URL of the stored cover. Saved: that URL keeps it, another URL or a data URI replaces it,
	// none clears it (a new view of a stored episode keeps it).
	cover: z.string().optional(),
	tags: z.array(z.string()).optional(),
	// Program tags not applied to this episode
	ignoredTags: z.array(z.string()).optional(),
	externalId: z.string().optional(),
	seasonId: z.uuid().optional(),
	formatId: z.uuid().optional(),
	// order within its season, when the source gives one
	position: z.number().optional(),
	// the only displayed number: "12", "bonus", "Vlog 5"
	numberLabel: z.string().optional(),
	status: EpisodeStatusSchema.optional(),
	// guests, interviewees, hosts of this episode
	credits: z.array(EpisodeCreditSchema),
	views: z.array(ViewSchema),
});
// One line of the lists (programs, history, sync): a view with its episode's fields, as the forms edit it.
// `durationReal` is the view's duration (`duration` being the episode's).
export const EpisodeLineSchema = EpisodeSchema.omit({ id: true, views: true }).extend({
	id: z.uuid(),
	episodeId: z.uuid(),
	date: z.iso.date(),
	durationReal: z.number().optional(),
	contextTags: z.array(z.string()).optional(),
	comment: z.string().optional(),
	created: z.iso.datetime({ local: true }).optional(),
});
const refsSchema = z.object(Object.fromEntries(refIds.map((key) => [key, z.string().optional()])));
export type Refs = z.infer<typeof refsSchema>;
export const ProgramSchema = z.object({
	id: z.uuidv4(),
	name: z.string(),
	shortName: z.string().optional(),
	author: z.string().optional(),
	country: z.string().optional(),
	network: z.string().optional(),
	tracking: TrackingSchema,
	// author = the host and producer credits, network = the network ones: their names joined with " && "
	credits: z.array(ProgramCreditSchema),
	links: z.array(z.url()).optional(),
	profile: z.string().optional(),
	banner: z.string().optional(),
	episodes: z.array(EpisodeSchema),
	tags: z.array(z.string()).optional(),
	refs: refsSchema.optional(),
	description: z.string().optional(),
	type: z.string().optional(),
	private: z.boolean().optional(),
});

export type View = z.infer<typeof ViewSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
export type EpisodeLine = z.infer<typeof EpisodeLineSchema>;
export type Program = z.infer<typeof ProgramSchema>;

// GET /programs/:programId (and the program writes): the episodes, latest first, and their figures
export const ProgramDetailsSchema = ProgramSchema.extend({
	seasons: z.array(SeasonSchema),
	formats: z.array(FormatSchema),
	details: z.object({
		episodes: z.number(),
		averageLength: z.number(),
		completionRate: z.number(),
		// the latest episode's, "" without episode
		lastSeenDate: z.string(),
		// the stored releases, and those with a view (a catalog's progress)
		releases: z.number(),
		watched: z.number(),
		// the releases not to watch (left out of the progress)
		skipped: z.number(),
	}),
});
export type ProgramDetails = z.infer<typeof ProgramDetailsSchema>;

// GET /programs: a program without its episodes, with their count, total and latest date (null without episode)
export const ProgramSummarySchema = ProgramSchema.omit({ episodes: true }).extend({
	episodeCount: z.number(),
	totalDuration: z.number(),
	latestEpisodeDate: z.iso.date().nullable(),
});
export type ProgramSummaryItem = z.infer<typeof ProgramSummarySchema>;
export const ProgramListResponseSchema = z.array(ProgramSummarySchema);

// GET /episodes: the programs with an episode in the period, each with only those episodes
export const EpisodeListResponseSchema = z.array(ProgramSchema);

// POST /sync-covers
const CoverSyncItemSchema = z.object({ id: z.string(), name: z.string() });
export const SyncCoversResponseSchema = z.object({
	successes: z.array(CoverSyncItemSchema),
	errors: z.array(CoverSyncItemSchema.extend({ error: z.string() })),
});

//
// LIST PROGRAMS
//
export const ProgramListQuerystringRequestSchema = SortQSSchema.extend(SearchQSSchema.shape);

//
// LIST EPISODES
//
export const EpisodeListQuerystringRequestSchema = OptionalPeriodQSSchema;

//
// DETAIL PROGRAM
//
export const DetailsProgramParamsRequestSchema = z.object({
	programId: z.uuid(),
});

//
// SAVE
//
// PUT /programs/:programId/episodes/:episodeId: the episode's fields (its views and its status have their own routes)
export const SaveEpisodeBodyRequestSchema = EpisodeSchema.omit({
	id: true,
	views: true,
	credits: true,
	status: true,
}).extend({
	// every credit of the episode: left out = none
	credits: z.array(SaveEpisodeCreditSchema).default([]),
});
export type SaveEpisodeBodyRequestType = z.infer<typeof SaveEpisodeBodyRequestSchema>;
// POST /programs/:programId/episodes/:episodeId/views, PUT …/views/:viewId
export const SaveViewBodyRequestSchema = ViewSchema.omit({ id: true, created: true });
export type SaveViewBodyRequestType = z.infer<typeof SaveViewBodyRequestSchema>;
// POST /programs/:programId/episodes: the episode with its first view, or put on the watchlist (status planned).
// An episode of the program with the same externalId gets the view (a relistening) or the status instead.
export const CreateEpisodeBodyRequestSchema = SaveEpisodeBodyRequestSchema.extend({
	view: SaveViewBodyRequestSchema.optional(),
	status: z.literal("planned").optional(),
}).refine(({ view, status }) => Boolean(view) !== Boolean(status), {
	message: "Expected either a view, or the status planned",
});
export type CreateEpisodeBodyRequestType = z.infer<typeof CreateEpisodeBodyRequestSchema>;
// POST /programs (with an optional first episode), PUT /programs/:programId (the episode is ignored)
// `credits` left out = unchanged
export const SaveProgramBodyRequestSchema = ProgramSchema.omit({
	id: true,
	episodes: true,
	author: true,
	network: true,
	credits: true,
	tracking: true,
}).extend({
	credits: z.array(SaveProgramCreditSchema).optional(),
	// left out: feed for a new program, unchanged otherwise. Back to feed, the episodes without a view are deleted.
	tracking: TrackingSchema.optional(),
});
export const SaveBodyRequestSchema = z.object({
	program: SaveProgramBodyRequestSchema,
	episode: CreateEpisodeBodyRequestSchema.optional(),
});
export type SaveBodyRequestType = z.infer<typeof SaveBodyRequestSchema>;

// POST /sync/:id/validate: a proposal becomes a new program with its episode, or an episode of `programId`
export const SyncValidateBodyRequestSchema = z
	.object({
		program: SaveProgramBodyRequestSchema.optional(),
		episode: CreateEpisodeBodyRequestSchema,
		// the form sends "" with a new program
		programId: z.string().optional(),
	})
	.refine(({ program, programId }) => Boolean(program) !== Boolean(programId), {
		message: "Expected either a new program, or the programId of an existing one",
	});
export type SyncValidateBodyRequestType = z.infer<typeof SyncValidateBodyRequestSchema>;
// the new program, or the episode added to an existing one
export const SyncValidateResponseSchema = z.union([ProgramDetailsSchema, EpisodeSchema]);

//
// DELETE
//
export const DeleteParamsRequestSchema = z.object({
	programId: z.uuid(),
	episodeId: z.uuid(),
});

export type DeleteParamsRequest = z.infer<typeof DeleteParamsRequestSchema>;

// PUT /programs/:programId/seasons, PUT /programs/:programId/formats: the whole ordered list (an item with an id
// is kept, one without is created, one left out is deleted: its episodes lose it). Answers the saved list.
export const SaveSeasonsBodyRequestSchema = z.object({
	seasons: z.array(z.object({ id: z.uuid().optional(), label: z.string().trim().nonempty() })),
});
export type SaveSeasonsBodyRequestType = z.infer<typeof SaveSeasonsBodyRequestSchema>;
export const SaveFormatsBodyRequestSchema = z.object({
	formats: z.array(
		z.object({
			id: z.uuid().optional(),
			label: z.string().trim().nonempty(),
			match: z.string().trim().nonempty().refine(isRegex, "Not a regular expression").nullable(),
		}),
	),
});
export type SaveFormatsBodyRequestType = z.infer<typeof SaveFormatsBodyRequestSchema>;
export const SeasonListResponseSchema = z.array(SeasonSchema);
export const FormatListResponseSchema = z.array(FormatSchema);

// POST /programs/:programId/import: the program's episodes from one of its sources: every release for a catalog,
// only the stored episodes completed for a feed.
// Two sources of a program never match each other's episodes (a guid is not a videoId): one is imported.
export const ImportBodyRequestSchema = z.object({ source: RefIdsEnumSchema });
export type ImportBodyRequest = z.infer<typeof ImportBodyRequestSchema>;
export const ImportResponseSchema = z.object({
	created: z.number(),
	// the known episodes changed (title, release date, duration, or an empty season, number, format filled)
	updated: z.number(),
});
export type ImportResponse = z.infer<typeof ImportResponseSchema>;

// PUT / DELETE /programs/:programId/episodes/:episodeId/views/:viewId
export const ViewParamsRequestSchema = DeleteParamsRequestSchema.extend({
	viewId: z.uuid(),
});
export type ViewParamsRequest = z.infer<typeof ViewParamsRequestSchema>;

// PUT /programs/:programId/episodes/:episodeId/status (204): null clears it (a feed then deletes the episode left
// without any view)
export const EpisodeStatusBodyRequestSchema = z.object({ status: EpisodeStatusSchema.nullable() });
export type EpisodeStatusBodyRequest = z.infer<typeof EpisodeStatusBodyRequestSchema>;

// GET /watchlist: the planned episodes of every program, oldest release first (no release date last)
export const WatchlistResponseSchema = z.array(
	z.object({
		programId: z.uuid(),
		programName: z.string(),
		episode: EpisodeSchema,
	}),
);
export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;

//
// LATEST EPISODES FROM EXISTING PROGRAM
//
// Request
export const LatestQuerystringRequestSchema = z.object({
	force: RefIdsEnumSchema.optional(),
});

export const LatestParamsRequestSchema = z.object({
	programId: z.uuidv4(),
});

// Response
export const EpisodeDataFromSourceSchema = z.object({
	id: z.string(),
	title: z.string(),
	duration: z.union([z.string(), z.number()]),
	durationInMinutes: z.number(),
	date: z.string(),
	link: z.string().optional(),
	type: z.string(),
	// plain text, and the URL of the source's image
	description: z.string().optional(),
	cover: z.string().optional(),
	// (a program's latest episodes) the stored one has a view / its status
	view: z.boolean().optional(),
	status: EpisodeStatusSchema.optional(),
});
export type EpisodeDataFromSource = z.infer<typeof EpisodeDataFromSourceSchema>;

export const LatestEpisodesResponseSchema = z.object({
	// when they were fetched: a local date-time (no offset), despite the name
	dateTimeUtc: z.iso.datetime({ local: true }),
	type: RefIdsEnumSchema,
	latestEpisodes: z.array(EpisodeDataFromSourceSchema),
});
export type LatestEpisodesResponse = z.infer<typeof LatestEpisodesResponseSchema>;

//
// LATEST EPISODES FROM NEW PROGRAM (generic)
//
export const LatestGenericQuerystringRequestSchema = z.object({
	url: z.url(),
	type: RefIdsEnumSchema,
});
export type LatestGenericQuerystringRequest = z.infer<typeof LatestGenericQuerystringRequestSchema>;

//
// EXTRACTED DATA
//
// Request
export const ExtractQuerystringRequestSchema = z.object({
	url: z.string(),
});
export type ExtractQuerystringRequest = z.infer<typeof ExtractQuerystringRequestSchema>;

// Response
export const ExtractedDataSchema = EpisodeDataFromSourceSchema.extend({
	author: z
		.object({
			name: z.string(),
			description: z.string().optional(),
			type: z.string().optional(),
			channelId: z.string(),
			url: z.string(),
		})
		.optional(),
	suggestedPrograms: z.array(ProgramSchema.pick({ id: true, name: true, author: true, network: true })).optional(),
});
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

//
// STATS
//
// Request
export const StatsRequestSchema = PeriodQSSchema;
// Response
export const ProgramStatsRecord = z.object({
	name: z.string(),
	duration: z.number(),
});
export const SummaryStatsSchema = z.object({
	averageByDays: z.number(),
	total: z.number(),
	nbPrograms: z.number(),
	nbEpisodes: z.number(),
	nbDays: z.number(),
});
export const StatsRecordResponseSchema = z.object({
	summary: SummaryStatsSchema,
	programs: z.record(z.string(), ProgramStatsRecord),
	tags: z.record(
		z.string(),
		z.object({
			name: z.string(),
			duration: z.number(),
			details: z.record(z.string(), ProgramStatsRecord),
		}),
	),
});
export type StatsRecordResponse = z.infer<typeof StatsRecordResponseSchema>;

export const StatsArrayResponseSchema = z.object({
	summary: SummaryStatsSchema.extend({ inProgress: z.boolean() }),
	programs: z.array(ProgramStatsRecord),
	tags: z.array(
		z.object({
			name: z.string(),
			duration: z.number(),
			details: z.array(ProgramStatsRecord),
		}),
	),
});
export type StatsArrayResponse = z.infer<typeof StatsArrayResponseSchema>;

//
// REVIEW (episodes without any tag)
//
// Response
export const ReviewEpisodesResponseSchema = z.array(
	z.object({
		programId: z.uuid(),
		programName: z.string(),
		episode: EpisodeSchema,
	}),
);
export type ReviewEpisodesResponse = z.infer<typeof ReviewEpisodesResponseSchema>;

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
// SYNC (ANTENNA POD)
//
// Object
const OriginSchema = z.object({
	program: z.string(),
	episode: z.string(),
	externalId: z.string(),
	datetime: z.iso.datetime({ local: true }),
	duration: z.string(),
	listened: z.string(),
	percentListened: z.number(),
});
// Request
export const SyncUploadBodyRequestSchema = z.instanceof(Uint8Array);

export const SyncProposalParamsRequestSchema = z.object({
	id: z.uuid(),
});

export const SyncDeleteParamsRequestSchema = z.object({
	id: z.uuid(),
});
export type SyncDeleteParamsRequest = z.infer<typeof SyncDeleteParamsRequestSchema>;

export const SyncFeedBodyRequestSchema = z.object({
	rssUrl: z.string().min(1),
});
export type SyncFeedBodyRequest = z.infer<typeof SyncFeedBodyRequestSchema>;

export const SyncReprocessBodyRequestSchema = SyncFeedBodyRequestSchema.partial().nullish();

export const SyncLinkFeedBodyRequestSchema = SyncFeedBodyRequestSchema.extend({
	programId: z.uuid(),
});
export type SyncLinkFeedBodyRequest = z.infer<typeof SyncLinkFeedBodyRequestSchema>;

// gopodder (gpodder.net API) episode actions: GET /api/2/episodes/{user}.json?since=
export const GopodderEpisodeActionSchema = z.object({
	podcast: z.string(),
	episode: z.string(),
	guid: z.string().optional(),
	action: z.string(),
	// UTC, without zone suffix
	timestamp: z.string(),
	started: z.number().optional(),
	position: z.number().optional(),
	total: z.number().optional(),
});
export type GopodderEpisodeAction = z.infer<typeof GopodderEpisodeActionSchema>;
export const GopodderEpisodeActionsResponseSchema = z.object({
	actions: z.array(GopodderEpisodeActionSchema),
	timestamp: z.number(),
});

// Response
export const SyncResponseSchema = z.array(
	z.object({
		id: z.uuid(),
		origin: OriginSchema,
		proposition: EpisodeLineSchema.omit({ id: true, episodeId: true })
			.partial()
			.extend({
				programId: z.string().optional(),
				programProfile: z.string().optional(),
			})
			.optional(),
		// The matched episode is already saved in the program (relistening?): date of the saved one
		alreadySaved: z.object({ date: z.iso.date() }).optional(),
	}),
);
export type SyncResponse = z.infer<typeof SyncResponseSchema>;

export const SyncCreateResponseSchema = z.object({
	count: z.number(),
	// First gopodder sync: only the starting point is recorded
	initialized: z.boolean().optional(),
});
export type SyncCreateResponse = z.infer<typeof SyncCreateResponseSchema>;

export const SyncGopodderStatusResponseSchema = z.object({
	// Paris local time of the last gopodder sync, null before the first one
	lastSync: z.iso.datetime({ local: true }).nullable(),
});
export type SyncGopodderStatusResponse = z.infer<typeof SyncGopodderStatusResponseSchema>;

export const SyncUnknownFeedsResponseSchema = z.array(
	z.object({
		rssUrl: z.string(),
		title: z.string(),
		count: z.number(),
	}),
);
export type SyncUnknownFeedsResponse = z.infer<typeof SyncUnknownFeedsResponseSchema>;

//
// ENTITY CREDITS
//
// What an entity does in broadcast, for its page in the directory: its program credits (by program name) and its
// episode credits (latest release first), one item per role
export const EntityBroadcastParamsRequestSchema = z.object({ entityId: z.uuid() });
export const EntityBroadcastResponseSchema = z.object({
	programs: z.array(
		z.object({
			id: z.uuid(),
			name: z.string(),
			profile: z.string().optional(),
			role: ProgramCreditRoleSchema,
			creditedAs: z.string().nullable(),
		}),
	),
	// each with its views, as in the program details (no credits)
	episodes: z.array(
		EpisodeSchema.extend({
			role: EpisodeCreditRoleSchema,
			creditedAs: z.string().nullable(),
			program: z.object({ id: z.uuid(), name: z.string() }),
		}),
	),
});
export type EntityBroadcastResponse = z.infer<typeof EntityBroadcastResponseSchema>;
