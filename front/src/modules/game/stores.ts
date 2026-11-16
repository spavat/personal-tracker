import type { GameStore } from "@personal-tracker/shared/game";

export const STORE_LABELS: Record<GameStore, string> = {
	steam: "Steam",
	gog: "GOG",
	epic: "Epic Games",
};

/** Store page of a Steam app (GOG and Epic pages need a slug the store id doesn't give). */
export const steamStoreUrl = (appId: string) => `https://store.steampowered.com/app/${appId}/`;
