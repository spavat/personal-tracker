import type { GameOrigin, GameStore } from "@personal-tracker/shared/game";

import type { StoreTotal } from "./sync.entity";

/** A game's cumulative playtime in a store, with the store's own info about the game. */
export interface StoreGame extends StoreTotal {
	developer?: string;
	publisher?: string;
	image?: string;
}

/**
 * One store's playtime source. `fetchRaw` only does network calls and its result is stored as-is (snapshot),
 * so that `parse`, which is pure, can recompute a day later without calling the store again.
 */
export interface StoreConnector {
	store: GameStore;
	// origins of the plays it produces (a replay replaces the auto plays of these origins)
	origins: GameOrigin[];
	isConfigured(): Promise<boolean>;
	fetchRaw(): Promise<unknown>;
	parse(raw: unknown): StoreGame[];
}

/** GET/POST a store endpoint and return its JSON, with the store name in the error message. */
export async function fetchStoreJson(storeLabel: string, url: string, init?: RequestInit): Promise<unknown> {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(`${storeLabel} : erreur ${response.status} sur ${new URL(url).pathname}`);
	}
	return response.json();
}
