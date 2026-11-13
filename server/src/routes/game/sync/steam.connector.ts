import type { GameOrigin } from "@personal-tracker/shared/game";

import * as z from "zod";

import type { StoreConnector, StoreGame } from "./connector";

import { fetchStoreJson } from "./connector";

const OWNED_GAMES_URL = "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";

// playtimes in minutes; rtime_last_played in unix seconds, 0 when unknown
const SteamOwnedGamesSchema = z.object({
	response: z.object({
		games: z.array(
			z.object({
				appid: z.number(),
				name: z.string().optional(),
				playtime_forever: z.number(),
				playtime_deck_forever: z.number().optional(),
				rtime_last_played: z.number().optional(),
			}),
		),
	}),
});

export class SteamConnector implements StoreConnector {
	store = "steam" as const;
	origins: GameOrigin[] = ["steam", "steam-deck"];

	constructor(private config: { apiKey: string; steamId: string }) {}

	async isConfigured() {
		return Boolean(this.config.apiKey && this.config.steamId);
	}

	async fetchRaw() {
		const url = new URL(OWNED_GAMES_URL);
		url.search = new URLSearchParams({
			key: this.config.apiKey,
			steamid: this.config.steamId,
			include_appinfo: "1",
			include_played_free_games: "1",
			format: "json",
		}).toString();
		const raw = await fetchStoreJson("Steam", url.toString());
		// a private "game details" setting answers 200 with an empty response
		if (!SteamOwnedGamesSchema.safeParse(raw).success) {
			throw new Error("Steam : aucune liste de jeux (détails de jeu du profil privés ?)");
		}
		return raw;
	}

	/**
	 * Steam Deck time is its own origin: `steam` is the rest (forever − deck). The per-OS fields are not used:
	 * old playtime isn't split by platform.
	 */
	parse(raw: unknown): StoreGame[] {
		return SteamOwnedGamesSchema.parse(raw).response.games.flatMap((game) => {
			const deck = game.playtime_deck_forever ?? 0;
			const base = {
				storeGameId: String(game.appid),
				...(game.name ? { name: game.name } : {}),
				...(game.rtime_last_played
					? { lastPlayed: Temporal.Instant.fromEpochMilliseconds(game.rtime_last_played * 1000).toString() }
					: {}),
			};
			const totals: StoreGame[] = [];
			if (game.playtime_forever - deck > 0) {
				totals.push({ ...base, origin: "steam", seconds: (game.playtime_forever - deck) * 60 });
			}
			if (deck > 0) {
				totals.push({ ...base, origin: "steam-deck", seconds: deck * 60 });
			}
			return totals;
		});
	}
}
