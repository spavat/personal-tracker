import {
	Game,
	GameWithOverview,
	GameSaveBodyRequestSchema,
	GameDeleteParamsRequestSchema,
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
