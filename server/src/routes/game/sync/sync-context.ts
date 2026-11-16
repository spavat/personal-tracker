import type { FastifyInstance } from "fastify";

import type { StoreConnector } from "./connector";

import { GOG_USERNAME, STEAM_API_KEY, STEAM_ID } from "../../../config/game-stores";
import { GameRepository } from "../game.repository";
import { GameImageStorageRepository } from "../image-storage.repository";
import { CredentialRepository } from "./credential.repository";
import { EpicConnector } from "./epic.connector";
import { GogConnector } from "./gog.connector";
import { SnapshotRepository } from "./snapshot.repository";
import { SteamStore } from "./steam-store";
import { SteamConnector } from "./steam.connector";

/** Connectors and repositories of the store sync, shared by its routes and the daily scheduler. */
export function buildSyncContext(mongo: FastifyInstance["mongo"]) {
	const credentials = new CredentialRepository(mongo);
	// a new store: one connector here
	const connectors: StoreConnector[] = [
		new SteamConnector({ apiKey: STEAM_API_KEY, steamId: STEAM_ID }),
		new GogConnector({ username: GOG_USERNAME }),
		new EpicConnector(credentials),
	];
	return {
		connectors,
		credentials,
		games: new GameRepository(mongo),
		snapshots: new SnapshotRepository(mongo),
		enrichment: { steam: new SteamStore(), images: new GameImageStorageRepository() },
	};
}
