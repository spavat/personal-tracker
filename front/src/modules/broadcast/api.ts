import {
	EntityBroadcastResponse,
	Program,
	ProgramSummaryItem,
	ExtractedData,
	ProgramDetails,
	SaveBodyRequestSchema,
	SaveEpisodeBodyRequestSchema,
	SaveViewBodyRequestSchema,
	CreateEpisodeBodyRequestSchema,
	ViewParamsRequestSchema,
	ViewParamsRequest,
	SaveSeasonsBodyRequestSchema,
	SaveSeasonsBodyRequestType,
	SaveFormatsBodyRequestSchema,
	SaveFormatsBodyRequestType,
	SyncValidateBodyRequestSchema,
	SyncValidateBodyRequestType,
	ImportResponse,
	ImportBodyRequestSchema,
	RefIdsEnum,
	EpisodeDataFromSource,
	EpisodeStatus,
	EpisodeStatusBodyRequestSchema,
	WatchlistResponse,
	matchFormat,
	Format,
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
} from "@personal-tracker/shared/broadcast";
import { queryOptions } from "@tanstack/react-query";

import type { MonthQueryConfig } from "../../hooks/use-month-changer";
import type { SortListConfig } from "../../hooks/use-sort-table";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, saveJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";
import { getCurrentOrPreviousDate } from "../../utils";
import { toCreateEpisodeBody, toEpisodeBody, toViewBody } from "./episode-lines";

async function getProgramListYear(from: string, to: string) {
	return fetchJson<Array<Program>>(withQuery(`${API_BASE_URL}/broadcast/episodes`, { from, to }));
}
export const programHistory: MonthQueryConfig<Array<Program>> = {
	queryKey: ["programs"],
	queryFn: getProgramListYear,
};

export async function getProgramList(search?: string) {
	return fetchJson<Array<ProgramSummaryItem>>(withQuery(`${API_BASE_URL}/broadcast/programs`, { search }));
}
export const programsQuery = () =>
	queryOptions({
		queryKey: ["programs"],
		queryFn: () => getProgramList(),
	});

async function getProgramListSorted(sortField: string, sortDirection: string) {
	return fetchJson<Array<ProgramSummaryItem>>(
		withQuery(`${API_BASE_URL}/broadcast/programs`, { sort: [sortField, sortDirection] }),
	);
}
export const programListSort: SortListConfig<ProgramSummaryItem> = {
	sortOptions: { localKey: "broadcast_program_list", defaultField: "latestEpisodeDate", defaultDirection: "desc" },
	queryKey: ["programs"],
	queryFn: getProgramListSorted,
};

async function getProgramDetails(id: string) {
	return fetchJson<ProgramDetails>(`${API_BASE_URL}/broadcast/programs/${id}`);
}
export const programDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["program", id],
		queryFn: () => getProgramDetails(id),
	});

// What an entity does in broadcast, for its directory page ("programs": refreshed with the programs)
export const entityBroadcastQuery = (entityId: string) =>
	queryOptions({
		queryKey: ["programs", "entities", entityId],
		queryFn: () => fetchJson<EntityBroadcastResponse>(`${API_BASE_URL}/broadcast/entities/${entityId}`),
	});

export async function getLatestEpisodes(id: string, forceType?: string) {
	return fetchJson<LatestEpisodesResponse>(withQuery(`${API_BASE_URL}/broadcast/latest/${id}`, { force: forceType }));
}
export async function getDirectLatestEpisodes(params: string) {
	return fetchJson<LatestEpisodesResponse>(`${API_BASE_URL}/broadcast/latest${params}`);
}

export async function getInfoFromLink(link: string) {
	return fetchJson<ExtractedData>(withQuery(`${API_BASE_URL}/broadcast/extract`, { url: link }));
}

async function getStatsYear(from: string, to: string) {
	return fetchJson<StatsArrayResponse>(withQuery(`${API_BASE_URL}/broadcast/stats`, { from, to }));
}
export const broadcastStats: YearQueryConfig<StatsArrayResponse> = {
	queryKey: ["programs", "stats"],
	queryFn: getStatsYear,
};

// Episodes without any tag (key under ["programs"]: refreshed on every save)
async function getReview() {
	return fetchJson<ReviewEpisodesResponse>(`${API_BASE_URL}/broadcast/review`);
}
export const reviewQuery = () =>
	queryOptions({
		queryKey: ["programs", "review"],
		queryFn: () => getReview(),
	});

// A program (with an optional first line), or a line of the program `programId`: a new line creates its episode
// with its view (an episode of the program with the same externalId gets the view), an edited one saves its episode
// (shared by its views) then its view
export async function save({ program, episode, programId }: any) {
	if (program) {
		return saveJson(
			`${API_BASE_URL}/broadcast/programs`,
			program.id,
			SaveBodyRequestSchema.parse({ program, episode: episode && toCreateEpisodeBody(episode) }),
		);
	}
	const episodesUrl = `${API_BASE_URL}/broadcast/programs/${programId}/episodes`;
	if (!episode.id) {
		return sendJson(episodesUrl, "POST", CreateEpisodeBodyRequestSchema.parse(toCreateEpisodeBody(episode)));
	}
	await sendJson(
		`${episodesUrl}/${episode.episodeId}`,
		"PUT",
		SaveEpisodeBodyRequestSchema.parse(toEpisodeBody(episode)),
	);
	return sendJson(
		`${episodesUrl}/${episode.episodeId}/views/${episode.id}`,
		"PUT",
		SaveViewBodyRequestSchema.parse(toViewBody(episode)),
	);
}

// the whole ordered list of a program's seasons / formats
export async function saveSeasons(programId: string, data: SaveSeasonsBodyRequestType) {
	return sendJson(
		`${API_BASE_URL}/broadcast/programs/${programId}/seasons`,
		"PUT",
		SaveSeasonsBodyRequestSchema.parse(data),
	);
}
export async function saveFormats(programId: string, data: SaveFormatsBodyRequestType) {
	return sendJson(
		`${API_BASE_URL}/broadcast/programs/${programId}/formats`,
		"PUT",
		SaveFormatsBodyRequestSchema.parse(data),
	);
}

// a catalog: every release of one of the program's sources; a feed: its stored episodes completed
export async function importCatalog(programId: string, source: RefIdsEnum) {
	return sendJson<ImportResponse>(
		`${API_BASE_URL}/broadcast/programs/${programId}/import`,
		"POST",
		ImportBodyRequestSchema.parse({ source }),
	);
}

// "Vu": a view of the whole episode, today
export async function addView(programId: string, episodeId: string) {
	return sendJson(
		`${API_BASE_URL}/broadcast/programs/${programId}/episodes/${episodeId}/views`,
		"POST",
		SaveViewBodyRequestSchema.parse({ date: getCurrentOrPreviousDate() }),
	);
}

// null clears it (an episode of a feed without any view goes)
export async function setEpisodeStatus(programId: string, episodeId: string, status: EpisodeStatus | null) {
	return sendJson(
		`${API_BASE_URL}/broadcast/programs/${programId}/episodes/${episodeId}/status`,
		"PUT",
		EpisodeStatusBodyRequestSchema.parse({ status }),
	);
}

// "Ajouter à la liste": a latest episode planned, without view (a stored one with this externalId gets the status)
export async function planLatestEpisode(programId: string, episode: EpisodeDataFromSource, formats: Array<Format>) {
	return sendJson(
		`${API_BASE_URL}/broadcast/programs/${programId}/episodes`,
		"POST",
		CreateEpisodeBodyRequestSchema.parse({
			name: episode.title,
			duration: episode.durationInMinutes,
			type: episode.type,
			releaseDate: episode.date || undefined,
			link: episode.link || undefined,
			externalId: episode.id,
			description: episode.description,
			cover: episode.cover,
			formatId: matchFormat(formats, episode.title)?.id,
			status: "planned",
		}),
	);
}

// The planned episodes (key under ["programs"]: refreshed on every save)
async function getWatchlist() {
	return fetchJson<WatchlistResponse>(`${API_BASE_URL}/broadcast/watchlist`);
}
export const watchlistQuery = () =>
	queryOptions({
		queryKey: ["programs", "watchlist"],
		queryFn: () => getWatchlist(),
	});

// a line: its view (the episode goes too when it was its last view)
export async function deleteLine(data: ViewParamsRequest) {
	const { programId, episodeId, viewId } = ViewParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/broadcast/programs/${programId}/episodes/${episodeId}/views/${viewId}`, "DELETE");
}

export async function getFortnightStats() {
	return fetchJson<FortnightStatsRespons>(`${API_BASE_URL}/broadcast/stats/fortnight`);
}

async function getSync() {
	return fetchJson<SyncResponse>(`${API_BASE_URL}/broadcast/sync`);
}
export const syncQuery = () =>
	queryOptions({
		queryKey: ["sync"],
		queryFn: () => getSync(),
	});

export async function uploadSync(file: File) {
	return fetchJson<SyncCreateResponse>(`${API_BASE_URL}/broadcast/sync/upload`, {
		method: "POST",
		headers: {
			"Content-Type": "application/octet-stream",
		},
		body: file,
	});
}

// Date of the last gopodder sync (key under ["sync"]: refreshed with the proposals)
async function getGopodderStatus() {
	return fetchJson<SyncGopodderStatusResponse>(`${API_BASE_URL}/broadcast/sync/gopodder`);
}
export const gopodderStatusQuery = () =>
	queryOptions({
		queryKey: ["sync", "gopodder"],
		queryFn: () => getGopodderStatus(),
	});

export async function syncGopodder() {
	return sendJson<SyncCreateResponse>(`${API_BASE_URL}/broadcast/sync/gopodder`, "POST");
}

// Feeds of the current sync without a matching program (step 1)
async function getUnknownFeeds() {
	return fetchJson<SyncUnknownFeedsResponse>(`${API_BASE_URL}/broadcast/sync/feeds`);
}
export const unknownFeedsQuery = () =>
	queryOptions({
		queryKey: ["sync", "feeds"],
		queryFn: () => getUnknownFeeds(),
	});

export async function linkFeed(data: SyncLinkFeedBodyRequest) {
	return sendJson(`${API_BASE_URL}/broadcast/sync/feeds/link`, "POST", SyncLinkFeedBodyRequestSchema.parse(data));
}

export async function ignoreFeed(data: SyncFeedBodyRequest) {
	return sendJson(`${API_BASE_URL}/broadcast/sync/feeds/ignore`, "POST", SyncFeedBodyRequestSchema.parse(data));
}

// With rssUrl: only the proposals of that feed
export async function reprocessSync(rssUrl?: string) {
	return sendJson(`${API_BASE_URL}/broadcast/sync/reprocess`, "POST", rssUrl ? { rssUrl } : undefined);
}

// the proposal is edited as a line: its episode and its view
export async function validateSyncProposal(
	id: string,
	{
		episode,
		...data
	}: Omit<SyncValidateBodyRequestType, "episode"> & { episode: Parameters<typeof toCreateEpisodeBody>[0] },
) {
	const sentData = SyncValidateBodyRequestSchema.parse({ ...data, episode: toCreateEpisodeBody(episode) });
	return sendJson(`${API_BASE_URL}/broadcast/sync/${id}/validate`, "POST", sentData);
}

export async function deleteSyncProposal(data: SyncDeleteParamsRequest) {
	const { id } = SyncDeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/broadcast/sync/${id}`, "DELETE");
}
