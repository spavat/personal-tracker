import {
	Game,
	GameWithOverview,
	GameSaveBodyRequestSchema,
	GameDeleteParamsRequestSchema,
	GameMergeBodySchema,
	type GameImportRow,
	type GameMergeBody,
	type GameStore,
	type GameSyncStatus,
} from "@personal-tracker/shared/game";
import { queryOptions } from "@tanstack/react-query";

import type { SortListConfig } from "../../hooks/use-sort-table";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

async function getPlayListYear(from: string, to: string): Promise<Array<GameWithOverview>> {
	return fetchJson<Array<GameWithOverview>>(withQuery(`${API_BASE_URL}/game/plays`, { from, to }));
}
export const playHistory: YearQueryConfig<Array<GameWithOverview>> = {
	queryKey: ["game", "plays"],
	queryFn: getPlayListYear,
};

export async function getGameList(search?: string): Promise<Array<GameWithOverview>> {
	return fetchJson<Array<GameWithOverview>>(withQuery(`${API_BASE_URL}/game/games`, { search }));
}
export const gamesQuery = () =>
	queryOptions({
		queryKey: ["game", "games"],
		queryFn: () => getGameList(),
	});
async function getGameListSorted(sortField: string, sortDirection: string) {
	return fetchJson<Array<GameWithOverview>>(
		withQuery(`${API_BASE_URL}/game/games`, { sort: [sortField, sortDirection] }),
	);
}
export const gameListSort: SortListConfig<GameWithOverview> = {
	sortOptions: { localKey: "game_list", defaultField: "latestPlayDate", defaultDirection: "desc" },
	queryKey: ["game", "games"],
	queryFn: getGameListSorted,
};

async function getGameDetails(id: string) {
	return fetchJson<Game>(`${API_BASE_URL}/game/games/${id}`);
}
export const gameDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["game", "game", id],
		queryFn: () => getGameDetails(id),
	});

export async function save(data: any) {
	const sentData = GameSaveBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/game/save`, "POST", sentData);
}

export async function deleteItem(data: any) {
	const { gameId, playId } = GameDeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/game/games/${gameId}/plays/${playId}`, "DELETE");
}

//
// STORE SYNC (/game/integrations)
//
export const syncStatusQuery = () =>
	queryOptions({
		queryKey: ["game", "sync", "status"],
		queryFn: () => fetchJson<GameSyncStatus>(`${API_BASE_URL}/game/sync/status`),
	});

// POST: the server fetches the store, but writes nothing
export const importPreviewQuery = (store: GameStore) =>
	queryOptions({
		queryKey: ["game", "sync", "preview", store],
		queryFn: () => sendJson<Array<GameImportRow>>(`${API_BASE_URL}/game/sync/import/${store}/preview`, "POST"),
		// always the store's current totals
		gcTime: 0,
	});

export async function confirmImport(store: GameStore) {
	return sendJson<{ games: number; created: number; catchUpMinutes: number }>(
		`${API_BASE_URL}/game/sync/import/${store}`,
		"POST",
	);
}

export type SyncRunResult = {
	store: GameStore;
	status: "ok" | "error" | "baseline";
	plays: number;
	minutes: number;
	error?: string;
};
export async function runSync(store?: GameStore) {
	return sendJson<Array<SyncRunResult>>(`${API_BASE_URL}/game/sync/run`, "POST", store ? { store } : {});
}

export async function replaySync({ store, day }: { store: GameStore; day: string }) {
	return sendJson<{ plays: number; minutes: number }>(`${API_BASE_URL}/game/sync/replay/${store}/${day}`, "POST");
}

export async function mergeGames(data: GameMergeBody) {
	return sendJson<{ id: string }>(`${API_BASE_URL}/game/sync/merge`, "POST", GameMergeBodySchema.parse(data));
}
