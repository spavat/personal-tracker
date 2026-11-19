import type { Provider } from "@nestjs/common";

import { ConfigService } from "@nestjs/config";

import type { StoreConnector } from "./connector.js";

import { Env } from "../../config/env.schema.js";
import { CredentialRepository } from "./credential.repository.js";
import { EpicConnector } from "./epic.connector.js";
import { GogConnector } from "./gog.connector.js";
import { SteamConnector } from "./steam.connector.js";

export const STORE_CONNECTORS = Symbol("STORE_CONNECTORS");

// One connector per store; a new store is one more connector here
export const storeConnectorsProvider: Provider = {
	provide: STORE_CONNECTORS,
	inject: [ConfigService, CredentialRepository],
	useFactory: (config: ConfigService<Env, true>, credentials: CredentialRepository): StoreConnector[] => [
		new SteamConnector({
			apiKey: config.get("STEAM_API_KEY", { infer: true }),
			steamId: config.get("STEAM_ID", { infer: true }),
		}),
		new GogConnector({ username: config.get("GOG_USERNAME", { infer: true }) }),
		new EpicConnector(credentials),
	],
};
