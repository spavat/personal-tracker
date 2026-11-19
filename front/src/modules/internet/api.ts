import {
	Program,
	ProgramSummaryItem,
	ExtractedData,
	ProgramDetails,
	SaveBodyRequestSchema,
	SaveEpisodeBodyRequestSchema,
	DeleteParamsRequestSchema,
	DeleteParamsRequest,
	SyncValidateBodyRequestSchema,
	SyncValidateBodyRequestType,
	StatsArrayResponse,
	LatestEpisodesResponse,
	FortnightStatsRespons,
	SyncResponse,
	SyncDeleteParamsRequest,
	SyncDeleteParamsRequestSchema,
	SyncCreateResponse,
	SyncGopodderStatusResponse,
	SyncUnknownFeedsResponse,
	SyncLinkFeedBodyRequest,
	SyncLinkFeedBodyRequestSchema,
	SyncFeedBodyRequest,
	SyncFeedBodyRequestSchema,
	ReviewEpisodesResponse,
} from "@personal-tracker/shared/internet";
import { queryOptions } from "@tanstack/react-query";

import type { MonthQueryConfig } from "../../hooks/use-month-changer";
import type { SortListConfig } from "../../hooks/use-sort-table";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, saveJson, sendJson, withQuery } from "../../api-utils";
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
	return fetchJson<ProgramDetails>(`${API_BASE_URL}/internet/programs/${id}`);
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

// Episodes without any tag (key under ["programs"]: refreshed on every save)
async function getReview() {
	return fetchJson<ReviewEpisodesResponse>(`${API_BASE_URL}/internet/review`);
}
export const reviewQuery = () =>
	queryOptions({
		queryKey: ["programs", "review"],
		queryFn: () => getReview(),
	});

// a program (with an optional first episode), or an episode of the program `programId`
export async function save({ program, episode, programId }: any) {
	if (program) {
		const sentData = SaveBodyRequestSchema.parse({ program, episode });
		return sentData.program.id
			? sendJson(`${API_BASE_URL}/internet/programs/${sentData.program.id}`, "PUT", sentData)
			: sendJson(`${API_BASE_URL}/internet/programs`, "POST", sentData);
	}
	return saveJson(
		`${API_BASE_URL}/internet/programs/${programId}/episodes`,
		SaveEpisodeBodyRequestSchema.parse(episode),
	);
}

export async function deleteItem(data: DeleteParamsRequest) {
	const { programId, episodeId } = DeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/internet/programs/${programId}/episodes/${episodeId}`, "DELETE");
}

export async function getFortnightStats() {
	return fetchJson<FortnightStatsRespons>(`${API_BASE_URL}/internet/stats/fortnight`);
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
	return fetchJson<SyncCreateResponse>(`${API_BASE_URL}/internet/sync/upload`, {
		method: "POST",
		headers: {
			"Content-Type": "application/octet-stream",
		},
		body: file,
	});
}

// Date of the last gopodder sync (key under ["sync"]: refreshed with the proposals)
async function getGopodderStatus() {
	return fetchJson<SyncGopodderStatusResponse>(`${API_BASE_URL}/internet/sync/gopodder`);
}
export const gopodderStatusQuery = () =>
	queryOptions({
		queryKey: ["sync", "gopodder"],
		queryFn: () => getGopodderStatus(),
	});

export async function syncGopodder() {
	return sendJson<SyncCreateResponse>(`${API_BASE_URL}/internet/sync/gopodder`, "POST");
}

// Feeds of the current sync without a matching program (step 1)
async function getUnknownFeeds() {
	return fetchJson<SyncUnknownFeedsResponse>(`${API_BASE_URL}/internet/sync/feeds`);
}
export const unknownFeedsQuery = () =>
	queryOptions({
		queryKey: ["sync", "feeds"],
		queryFn: () => getUnknownFeeds(),
	});

export async function linkFeed(data: SyncLinkFeedBodyRequest) {
	return sendJson(`${API_BASE_URL}/internet/sync/feeds/link`, "POST", SyncLinkFeedBodyRequestSchema.parse(data));
}

export async function ignoreFeed(data: SyncFeedBodyRequest) {
	return sendJson(`${API_BASE_URL}/internet/sync/feeds/ignore`, "POST", SyncFeedBodyRequestSchema.parse(data));
}

// With rssUrl: only the proposals of that feed
export async function reprocessSync(rssUrl?: string) {
	return sendJson(`${API_BASE_URL}/internet/sync/reprocess`, "POST", rssUrl ? { rssUrl } : undefined);
}

export async function validateSyncProposal(id: string, data: SyncValidateBodyRequestType) {
	const sentData = SyncValidateBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/internet/sync/${id}/validate`, "POST", sentData);
}

export async function deleteSyncProposal(data: SyncDeleteParamsRequest) {
	const { id } = SyncDeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/internet/sync/${id}`, "DELETE");
}
