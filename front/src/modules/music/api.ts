import {
	ListResponseSchema,
	MusicGenresResponse,
	DeleteParamsRequest,
	DeleteGenreParamsRequestSchema,
	SaveGenreRequestSchema,
	StatsResponse,
	GetReportResponse,
	FortnightStatsRespons,
} from "@personal-tracker/shared/music";
import { queryOptions } from "@tanstack/react-query";

import type { MonthQueryConfig } from "../../hooks/use-month-changer";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

export async function getYearOfMusic(from: string, to: string) {
	const data = await fetchJson(withQuery(`${API_BASE_URL}/music/list`, { from, to }));
	const parsedResponse = ListResponseSchema.safeParse(data);
	if (!parsedResponse.success) {
		console.error(parsedResponse.error);
		return [];
	}
	return parsedResponse.data;
}
export const listeningHistory: MonthQueryConfig<Awaited<ReturnType<typeof getYearOfMusic>>> = {
	queryKey: ["music", "listenings"],
	queryFn: getYearOfMusic,
};

export async function searchMusic(search: string) {
	return fetchJson(withQuery(`${API_BASE_URL}/music/search`, { search }));
}

async function getListeningDetails(id: string) {
	return fetchJson(withQuery(`${API_BASE_URL}/music/id`, { id }));
}
export const listeningDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["music", "listenings", id],
		queryFn: () => getListeningDetails(id),
	});

async function getGenres() {
	const data = await fetchJson(`${API_BASE_URL}/music/genres`);
	const parsedResponse = MusicGenresResponse.safeParse(data);
	if (!parsedResponse.success) {
		console.error(parsedResponse.error);
		return [];
	}
	return parsedResponse.data;
}
export const genresQuery = () =>
	queryOptions({
		queryKey: ["music", "genres"],
		queryFn: () => getGenres(),
	});

async function getStats(from: string, to: string) {
	return fetchJson<StatsResponse>(withQuery(`${API_BASE_URL}/music/stats`, { from, to }));
}
export const musicStats: YearQueryConfig<StatsResponse> = {
	queryKey: ["music", "stats"],
	queryFn: getStats,
};

export async function getFortnightStats() {
	return fetchJson<FortnightStatsRespons>(`${API_BASE_URL}/music/fortnight-stats`);
}

export async function getReport(from: string, to: string) {
	return fetchJson<GetReportResponse>(withQuery(`${API_BASE_URL}/music/reports`, { from, to }));
}

export async function save(data: any) {
	return sendJson(`${API_BASE_URL}/music/save`, "POST", data);
}

export async function deleteItem(data: DeleteParamsRequest) {
	return sendJson(`${API_BASE_URL}/music/${data.id}`, "DELETE");
}

export async function saveGenre(data: any) {
	const sentData = SaveGenreRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/music/genres/save`, "POST", sentData);
}

export async function deleteGenre(data: any) {
	const { id } = DeleteGenreParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/music/genres/${id}`, "DELETE");
}
