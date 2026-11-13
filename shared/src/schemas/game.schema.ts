import * as z from "zod";

import { OptionalPeriodQSSchema, SearchQSSchema, SortQSSchema } from "./common.schema";

//
// OBJECTS
//
// Where a play happened (store launcher, console, device…)
export const GameOriginSchema = z.enum([
	"steam",
	"steam-deck",
	"gog",
	"epic",
	"battle-net",
	"ubisoft-connect",
	"riot",
	"itch-io",
	"executable",
	"ps5",
	"switch",
	"other",
]);
export type GameOrigin = z.infer<typeof GameOriginSchema>;

// Stores with a playtime connector
export const GameStoreSchema = z.enum(["steam", "gog", "epic"]);
export type GameStore = z.infer<typeof GameStoreSchema>;

// Date of the catch-up play holding the playtime recorded by a store before the first sync: not a real date
export const CATCH_UP_DATE = "1900-01-01";

export const GamePlaySchema = z.object({
	id: z.uuidv4(),
	date: z.iso.date(),
	duration: z.number().optional(),
	comment: z.string().optional(),
	created: z.iso.datetime({ local: true }).optional(),
	origin: GameOriginSchema.optional(),
	// written by the store sync; a manual edit turns it into a manual play
	auto: z.boolean().optional(),
});
export type GamePlay = z.infer<typeof GamePlaySchema>;

export const GameSchema = z.object({
	id: z.uuidv4(),
	name: z.string().nonempty(),
	developper: z.string().nonempty(),
	editor: z.string().nonempty(),
	complete: z.boolean().optional(),
	comment: z.string().optional(),
	links: z.array(z.object({ name: z.string(), link: z.url() })).optional(),
	// the game's id in each store it is owned on
	storeIds: z
		.object({
			steam: z.string(),
			gog: z.string(),
			epic: z.string(),
			battleNet: z.string(),
			ubisoftConnect: z.string(),
		})
		.partial()
		.optional(),
	// small banner (184x69) and title image (460x215)
	capsule: z.string().optional(),
	header: z.string().optional(),
	plays: z.array(GamePlaySchema),
});
export type Game = z.infer<typeof GameSchema>;

export const GameWithOverviewSchema = GameSchema.extend({
	latestPlayDate: z.iso.date(),
	playCount: z.number(),
});
export type GameWithOverview = z.infer<typeof GameWithOverviewSchema>;

//
// LIST GAMES
//
export const GameListQuerystringRequestSchema = SortQSSchema.extend(SearchQSSchema.shape);

//
// LIST PLAYS
//
export const PlayListQuerystringRequestSchema = OptionalPeriodQSSchema;

//
// DETAILS GAME
//
export const DetailsGameParamsRequestSchema = z.object({
	id: z.uuid(),
});

//
// SAVE
//
// Request
export const GameSaveBodyRequestSchema = z
	.object({
		game: GameSchema.partial({ id: true }).omit({ plays: true }).optional(),
		play: GamePlaySchema.partial({ id: true }).optional(),
		gameId: z.string().optional(),
	})
	.refine(({ game, play, gameId }) => {
		if (game && !gameId) {
			return true; // Add game (with or without play)
		}

		if (play && gameId) {
			return true; // Add play only
		}
		return false;
	});
export type GameSaveBodyRequestType = z.infer<typeof GameSaveBodyRequestSchema>;

//
// DELETE
//
// Request
export const GameDeleteParamsRequestSchema = z.object({
	gameId: z.uuid(),
	playId: z.uuid(),
});
export type GameDeleteParamsRequestType = z.infer<typeof GameDeleteParamsRequestSchema>;

//
// STORE SYNC
//
export const GameSyncStoreParamsSchema = z.object({ store: GameStoreSchema });
export const GameSyncReplayParamsSchema = z.object({ store: GameStoreSchema, day: z.iso.date() });
export const GameSyncRunBodySchema = z.object({ store: GameStoreSchema.optional() }).nullish();
export const GameMergeBodySchema = z.object({ keepId: z.uuid(), removeId: z.uuid() });
export type GameMergeBody = z.infer<typeof GameMergeBodySchema>;
export const GameMergeResponseSchema = z.object({ id: z.string() });

// game picture served by /images/game/:id/:field
export const GameImageParamsSchema = z.object({ id: z.uuid(), field: z.enum(["capsule", "header"]) });

// a store game in the initial import preview; no game = it will be created
export const GameImportRowSchema = z.object({
	storeGameId: z.string(),
	origin: GameOriginSchema,
	name: z.string(),
	storeMinutes: z.number(),
	recordedMinutes: z.number(),
	catchUp: z.number(),
	game: z.object({ id: z.string(), name: z.string() }).optional(),
});
export type GameImportRow = z.infer<typeof GameImportRowSchema>;
export const GameImportPreviewResponseSchema = z.array(GameImportRowSchema);

export const GameImportResponseSchema = z.object({
	games: z.number(),
	created: z.number(),
	catchUpMinutes: z.number(),
});

export const GameSyncRunResponseSchema = z.array(
	z.object({
		store: GameStoreSchema,
		status: z.enum(["ok", "error", "baseline"]),
		plays: z.number(),
		minutes: z.number(),
		error: z.string().optional(),
	}),
);

export const GameReplayResponseSchema = z.object({ plays: z.number(), minutes: z.number() });

export const GameSyncSnapshotSchema = z.object({
	id: z.string(),
	kind: z.enum(["import", "run"]),
	fetchedAt: z.string(),
	day: z.iso.date(),
	status: z.enum(["ok", "error"]),
	error: z.string().optional(),
});
export type GameSyncSnapshot = z.infer<typeof GameSyncSnapshotSchema>;

export const GameSyncStatusResponseSchema = z.object({
	stores: z.array(
		z.object({
			store: GameStoreSchema,
			configured: z.boolean(),
			linkedGames: z.number(),
			// most recent first, last 30 days
			snapshots: z.array(GameSyncSnapshotSchema),
			// Epic: the refresh token's end, after which `legendary auth` + the seed script are needed again
			tokenExpiresAt: z.string().optional(),
		}),
	),
	// games whose names match: candidates for a merge
	duplicates: z.array(z.array(z.object({ id: z.string(), name: z.string(), storeIds: GameSchema.shape.storeIds }))),
	// the latest fetch of a configured store failed
	lastRunFailed: z.boolean(),
});
export type GameSyncStatus = z.infer<typeof GameSyncStatusResponseSchema>;
