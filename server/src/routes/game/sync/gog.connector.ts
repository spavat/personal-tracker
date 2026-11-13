import type { GameOrigin } from "@personal-tracker/shared/game";

import * as z from "zod";

import type { StoreConnector, StoreGame } from "./connector";

import { fetchStoreJson } from "./connector";

// stats is keyed by the GOG user id when the game was played through Galaxy, an empty array otherwise
const GogStatsItemSchema = z.object({
	game: z.object({ id: z.string(), title: z.string(), image: z.string().optional() }),
	stats: z.union([
		z.array(z.unknown()),
		z.record(z.string(), z.object({ playtime: z.number().optional(), lastSession: z.string().optional() })),
	]),
});
const GogStatsPageSchema = z.object({
	page: z.number(),
	pages: z.number(),
	_embedded: z.object({ items: z.array(z.unknown()) }),
});

export class GogConnector implements StoreConnector {
	store = "gog" as const;
	origins: GameOrigin[] = ["gog"];

	constructor(private config: { username: string }) {}

	async isConfigured() {
		return Boolean(this.config.username);
	}

	/** Every page of the public profile's game stats, as one array of items. */
	async fetchRaw() {
		const items: unknown[] = [];
		let pages = 1;
		for (let page = 1; page <= pages; page++) {
			const url = `https://www.gog.com/u/${encodeURIComponent(this.config.username)}/games/stats?sort=recent_playtime&order=desc&page=${page}`;
			const result = GogStatsPageSchema.safeParse(
				await fetchStoreJson("GOG", url, { headers: { Accept: "application/json" } }).catch((error: Error) => {
					// a private profile answers 403
					throw new Error(`${error.message} (profil GOG privé ?)`);
				}),
			);
			if (!result.success) {
				throw new Error("GOG : réponse inattendue des statistiques du profil");
			}
			pages = result.data.pages;
			items.push(...result.data._embedded.items);
		}
		return items;
	}

	parse(raw: unknown): StoreGame[] {
		return z
			.array(GogStatsItemSchema)
			.parse(raw)
			.flatMap(({ game, stats }) => {
				const stat = Array.isArray(stats) ? undefined : Object.values(stats)[0];
				if (!stat?.playtime) {
					return [];
				}
				return [
					{
						storeGameId: game.id,
						name: game.title,
						origin: "gog" as const,
						seconds: stat.playtime * 60,
						...(stat.lastSession ? { lastPlayed: Temporal.Instant.from(stat.lastSession).toString() } : {}),
						...(game.image ? { image: game.image } : {}),
					},
				];
			});
	}
}
