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
