import * as z from "zod";

import { OptionalPeriodQSSchema, PeriodQSSchema, SearchQSSchema, SortQSSchema } from "./common.schema";

//
// ENUMERATIONS
//
const refIds = ["youtubeChannelId", "youtubePlaylistId", "rss"] as const;
export const RefIdsEnumSchema = z.enum(refIds);
export type RefIdsEnum = z.infer<typeof RefIdsEnumSchema>;

//
// OBJECTS
//
export const EpisodeSchema = z.object({
	id: z.uuidv4(),
	name: z.string(),
	shortName: z.string().optional(),
	duration: z.number(),
	durationReal: z.number().optional(),
	date: z.iso.date(),
	type: z.string(),
	link: z.url().optional().or(z.literal("")),
	tags: z.array(z.string()).optional(),
	contextTags: z.array(z.string()).optional(),
	created: z.iso.datetime({ local: true }).optional(),
	comment: z.string().optional(),
	externalId: z.string().optional(),
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
	links: z.array(z.url()).optional(),
	profile: z.string().optional(),
	banner: z.string().optional(),
	episodes: z.array(EpisodeSchema),
	tags: z.array(z.string()).optional(),
	refs: refsSchema.optional(),
	description: z.string().optional(),
	type: z.string().optional(),
});

export type Episode = z.infer<typeof EpisodeSchema>;
export type Program = z.infer<typeof ProgramSchema>;

export type ProgramDetails = Program & {
	details: {
		episodes: number;
		averageLength: number;
		completionRate: number;
		lastSeenDays: number;
		lastSeenDate: string;
	};
};

export interface ProgramSummaryItem extends Omit<Program, "episodes"> {
	episodeCount: number;
	totalDuration: number;
	latestEpisodeDate: "string";
}

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
export const SaveBodyRequestSchema = z
	.object({
		program: ProgramSchema.partial({ id: true }).omit({ episodes: true }).optional(),
		episode: EpisodeSchema.partial({ id: true }).optional(),
		programId: z.string().optional(),
	})
	.refine(({ program, episode, programId }) => {
		if (program && !programId) {
			return true; // Add program (with or without episode)
		}

		if (episode && programId) {
			return true; // Add episode only
		}
		return false;
	});
export type SaveBodyRequestType = z.infer<typeof SaveBodyRequestSchema>;

//
// DELETE
//
export const DeleteParamsRequestSchema = z.object({
	programId: z.uuid(),
	episodeId: z.uuid(),
});

export type DeleteParamsRequest = z.infer<typeof DeleteParamsRequestSchema>;

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
	view: z.boolean().optional(),
});
export type EpisodeDataFromSource = z.infer<typeof EpisodeDataFromSourceSchema>;

export const LatestEpisodesResponseSchema = z.object({
	dateTimeUtc: z.iso.datetime(),
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

// Response
export const SyncResponseSchema = z.array(
	z.object({
		id: z.uuid(),
		origin: OriginSchema,
		proposition: EpisodeSchema.partial()
			.extend({
				programId: z.string().optional(),
				programProfile: z.string().optional(),
			})
			.optional(),
	}),
);
export type SyncResponse = z.infer<typeof SyncResponseSchema>;
