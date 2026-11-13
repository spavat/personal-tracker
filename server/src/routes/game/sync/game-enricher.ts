import type { FastifyBaseLogger } from "fastify";

import type { GameMongo } from "../game.entity";
import type { GameImageField, GameImageStorageRepository } from "../image-storage.repository";
import type { StoreGame } from "./connector";
import type { SteamAppDetails, SteamStore } from "./steam-store";

export type GameEnrichment = Partial<Pick<GameMongo, "developper" | "editor" | "capsule" | "header">>;

/**
 * Info of a store game from Steam (developer, publisher, pictures): the game's own app on Steam, or the Steam app
 * with exactly its name for a GOG / Epic game. The store's own info is the fallback (Epic's developer is often
 * the publisher). Failures are logged and leave the field out: they never block the sync.
 */
export class GameEnricher {
	constructor(
		private steam: Pick<SteamStore, "details" | "findAppId">,
		private images: Pick<GameImageStorageRepository, "uploadFromSource">,
		private log: FastifyBaseLogger,
	) {}

	/** Steam app id of a GOG / Epic game: the Steam app with exactly its name. */
	async findSteamId(storeGame: StoreGame): Promise<string | undefined> {
		if (!storeGame.name) return undefined;
		try {
			return await this.steam.findAppId(storeGame.name);
		} catch (error) {
			this.log.warn({ storeGame: storeGame.storeGameId, error }, "game sync: Steam search failed");
			return undefined;
		}
	}

	/** Developer, publisher and pictures of a new game; `steamId`: its Steam app, when known. */
	async forNewGame(gameId: string, storeGame: StoreGame, steamId?: string): Promise<GameEnrichment> {
		const details = steamId ? await this.details(steamId) : null;
		const developer = details?.developer ?? storeGame.developer;
		const publisher = details?.publisher ?? storeGame.publisher;
		return {
			...(developer ? { developper: developer } : {}),
			...(publisher ? { editor: publisher } : {}),
			...(await this.pictures(gameId, details, storeGame)),
		};
	}

	/** The pictures an existing game lacks. */
	async missingPictures(
		game: Pick<GameMongo, "id" | "capsule" | "header">,
		storeGame: StoreGame,
		steamId?: string,
	): Promise<GameEnrichment> {
		if (game.capsule && game.header) return {};
		const details = steamId ? await this.details(steamId) : null;
		const pictures = await this.pictures(game.id, details, storeGame);
		return {
			...(!game.capsule && pictures.capsule ? { capsule: pictures.capsule } : {}),
			...(!game.header && pictures.header ? { header: pictures.header } : {}),
		};
	}

	private async details(steamId: string) {
		try {
			return await this.steam.details(steamId);
		} catch (error) {
			this.log.warn({ steamId, error }, "game sync: Steam store info failed");
			return null;
		}
	}

	private async pictures(gameId: string, details: SteamAppDetails | null, storeGame: StoreGame) {
		const sources: Record<GameImageField, string | undefined> = {
			capsule: details?.capsule ?? storeGame.image,
			header: details?.header ?? storeGame.image,
		};
		const keys: Partial<Record<GameImageField, string>> = {};
		for (const field of ["capsule", "header"] as const) {
			const source = sources[field];
			if (!source) continue;
			try {
				keys[field] = await this.images.uploadFromSource(gameId, field, source);
			} catch (error) {
				this.log.warn({ gameId, field, source, error }, "game sync: picture upload failed");
			}
		}
		return keys;
	}
}
