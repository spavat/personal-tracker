import {
	Program,
	ProgramSummaryItem,
	ExtractedData,
	ProgramDetails,
	SaveBodyRequestSchema,
	DeleteParamsRequestSchema,
	DeleteParamsRequest,
	SaveBodyRequestType,
	StatsArrayResponse,
	LatestEpisodesResponse,
	FortnightStatsRespons,
	SyncResponse,
	SyncDeleteParamsRequest,
	SyncDeleteParamsRequestSchema,
} from "@personal-tracker/shared/internet";
import { queryOptions } from "@tanstack/react-query";

import type { MonthQueryConfig } from "../../hooks/use-month-changer";
import type { SortListConfig } from "../../hooks/use-sort-table";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

async function getProgramListYear(from: string, to: string) {
	return fetchJson<Array<Program>>(withQuery(`${API_BASE_URL}/internet/episodes`, { from, to }));
}
export const programHistory: MonthQueryConfig<Array<Program>> = {
	queryKey: ["programs"],
	queryFn: getProgramListYear,
};

export async function getProgramList(search?: string) {
	return fetchJson<Array<ProgramSummaryItem>>(withQuery(`${API_BASE_URL}/internet/programs`, { search }));
}
export const programsQuery = () =>
	queryOptions({
		queryKey: ["programs"],
		queryFn: () => getProgramList(),
	});

async function getProgramListSorted(sortField: string, sortDirection: string) {
	return fetchJson<Array<ProgramSummaryItem>>(
		withQuery(`${API_BASE_URL}/internet/programs`, { sort: [sortField, sortDirection] }),
	);
}
export const programListSort: SortListConfig<ProgramSummaryItem> = {
	sortOptions: { localKey: "internet_program_list", defaultField: "latestEpisodeDate", defaultDirection: "desc" },
	queryKey: ["programs"],
	queryFn: getProgramListSorted,
};

async function getProgramDetails(id: string) {
	return fetchJson<ProgramDetails>(`${API_BASE_URL}/internet/id/${id}`);
}
export const programDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["program", id],
		queryFn: () => getProgramDetails(id),
	});

export async function getLatestEpisodes(id: string, forceType?: string) {
	return fetchJson<LatestEpisodesResponse>(withQuery(`${API_BASE_URL}/internet/latest/${id}`, { force: forceType }));
}
export async function getDirectLatestEpisodes(params: string) {
	return fetchJson<LatestEpisodesResponse>(`${API_BASE_URL}/internet/latest${params}`);
}

export async function getInfoFromLink(link: string) {
	return fetchJson<ExtractedData>(withQuery(`${API_BASE_URL}/internet/extract`, { url: link }));
}

async function getStatsYear(from: string, to: string) {
	return fetchJson<StatsArrayResponse>(withQuery(`${API_BASE_URL}/internet/stats`, { from, to }));
}
export const internetStats: YearQueryConfig<StatsArrayResponse> = {
	queryKey: ["programs", "stats"],
	queryFn: getStatsYear,
};

export async function save(data: SaveBodyRequestType) {
	const sentData = SaveBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/internet/save`, "POST", sentData);
}

export async function deleteItem(data: DeleteParamsRequest) {
	const { programId, episodeId } = DeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/internet/programs/${programId}/episodes/${episodeId}`, "DELETE");
}

export async function getFortnightStats() {
	return fetchJson<FortnightStatsRespons>(`${API_BASE_URL}/internet/fortnight-stats`);
}

async function getSync() {
	return fetchJson<SyncResponse>(`${API_BASE_URL}/internet/sync`);
}
export const syncQuery = () =>
	queryOptions({
		queryKey: ["sync"],
		queryFn: () => getSync(),
	});

export async function uploadSync(file: File) {
	return fetchJson(`${API_BASE_URL}/internet/sync/upload`, {
		method: "POST",
		headers: {
			"Content-Type": "application/octet-stream",
		},
		body: file,
	});
}

export async function reprocessSync() {
	return sendJson(`${API_BASE_URL}/internet/sync/reprocess`, "POST");
}

export async function validateSyncProposal(id: string, data: SaveBodyRequestType) {
	const sentData = SaveBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/internet/sync/validate/${id}`, "POST", sentData);
}

export async function deleteSyncProposal(data: SyncDeleteParamsRequest) {
	const { id } = SyncDeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/internet/sync/${id}`, "DELETE");
}
