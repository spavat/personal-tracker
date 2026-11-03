import {
	ArtistListResponse,
	ArtistDetailsResponse,
	ArtistView,
	PerformanceView,
	PlaceDetailsResponse,
	PlaceListResponse,
	SaveArtistBodyRequestSchema,
	SavePlaceBodyRequestSchema,
	SaveModelBodyRequestSchema,
	ModelDetailsResponse,
	SaveWorkBodyRequestSchema,
	WorkDetailsResponse,
	SaveCastingBodyRequestSchema,
	PerformanceDetailsResponse,
	SpectacleDetailsResponse,
	SavePerformanceBodyRequestSchema,
	SaveSpectacleBodyRequestSchema,
	WorkListResponse,
	SpectacleListResponse,
	GetReportResponse,
	SpectacleMedia,
	SpectacleMediaKind,
	ArtistMedia,
	UploadMediaBodyRequestSchema,
	UpdateMediaBodyRequestSchema,
	ReorderMediaBodyRequestSchema,
} from "@personal-tracker/shared/show";
import { queryOptions } from "@tanstack/react-query";

import type { SortListConfig } from "../../hooks/use-sort-table";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

export async function search(search: string) {
	return fetchJson<Array<any>>(withQuery(`${API_BASE_URL}/show/search`, { search }));
}

// WORKS
async function getWorks() {
	return fetchJson<WorkListResponse>(`${API_BASE_URL}/show/works/`);
}
export const worksQuery = () =>
	queryOptions({
		queryKey: ["shows", "works"],
		queryFn: () => getWorks(),
	});
async function getGroupedWorks(groupByYear: boolean) {
	return fetchJson<Array<any>>(
		withQuery(`${API_BASE_URL}/show/works/grouped`, { groupByYear: Boolean(groupByYear) }),
	);
}
export const groupedWorksQuery = (groupByYear: boolean) =>
	queryOptions({
		queryKey: ["shows", "works", groupByYear],
		queryFn: () => getGroupedWorks(groupByYear),
	});

// SPECTACLES
async function getSpectacles() {
	return fetchJson<SpectacleListResponse>(`${API_BASE_URL}/show/spectacles/`);
}
export const spectaclesQuery = () =>
	queryOptions({
		queryKey: ["shows", "spectacles"],
		queryFn: () => getSpectacles(),
	});
async function getGroupedSpectacles(groupByYear: boolean) {
	return fetchJson<Array<any>>(
		withQuery(`${API_BASE_URL}/show/spectacles/grouped`, { groupByYear: Boolean(groupByYear) }),
	);
}
export const groupedSpectaclesQuery = (groupByYear: boolean) =>
	queryOptions({
		queryKey: ["shows", "spectacles", groupByYear],
		queryFn: () => getGroupedSpectacles(groupByYear),
	});
async function getSpectacleDetails(id: string) {
	return fetchJson<SpectacleDetailsResponse>(`${API_BASE_URL}/show/spectacles/${id}`);
}
export const spectacleDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["shows", "spectacles", id],
		queryFn: () => getSpectacleDetails(id),
	});
export async function saveSpectacle(data: any) {
	const sentData = SaveSpectacleBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/show/spectacles/save`, "POST", sentData);
}

// PERFORMANCES
export async function getPerformances(from?: string, to?: string) {
	return fetchJson<Array<PerformanceView>>(withQuery(`${API_BASE_URL}/show/performances/`, { from, to }));
}
export const performancesQuery = () =>
	queryOptions({
		queryKey: ["shows", "performances"],
		queryFn: () => getPerformances(),
	});
export const performanceHistory: YearQueryConfig<Array<PerformanceView>> = {
	queryKey: ["shows", "performances"],
	queryFn: getPerformances,
};
async function getPerformanceDetails(id: string) {
	return fetchJson<PerformanceDetailsResponse>(`${API_BASE_URL}/show/performances/${id}`);
}
export const performanceDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["shows", "performances", id],
		queryFn: () => getPerformanceDetails(id),
	});

// ARTISTS
async function getArtists(field: string, direction: string) {
	return fetchJson<Array<ArtistListResponse>>(
		withQuery(`${API_BASE_URL}/show/artists/`, { sort: [field, direction] }),
	);
}
// all artists by name, for the artist pickers of the forms
export const artistsQuery = () =>
	queryOptions({
		queryKey: ["shows", "artists"],
		queryFn: () => getArtists("name", "asc"),
	});
export const artistListSort: SortListConfig<ArtistListResponse> = {
	sortOptions: { localKey: "show_artist_list", defaultField: "name", defaultDirection: "asc" },
	queryKey: ["shows", "artists"],
	queryFn: getArtists,
};
async function getArtistDetails(id: string, groupBySpectacle: boolean) {
	return fetchJson<ArtistDetailsResponse>(
		withQuery(`${API_BASE_URL}/show/artists/${id}`, { groupBySpectacle: Boolean(groupBySpectacle) }),
	);
}
export const artistDetailsQuery = (id: string, groupBySpectacle: boolean) =>
	queryOptions({
		queryKey: ["shows", "artists", id, groupBySpectacle],
		queryFn: () => getArtistDetails(id, groupBySpectacle),
	});
export async function saveArtist(data: any) {
	const sentData = SaveArtistBodyRequestSchema.parse(data);
	return sendJson<ArtistView>(`${API_BASE_URL}/show/artists/save`, "POST", sentData);
}
export async function deleteArtist(id: string) {
	return sendJson<void>(`${API_BASE_URL}/show/artists/${id}`, "DELETE");
}

// PLACES
async function getPlaces(field: string, direction: string) {
	return fetchJson<Array<PlaceListResponse>>(withQuery(`${API_BASE_URL}/show/places/`, { sort: [field, direction] }));
}
// all places by name, for the place picker of the forms
export const placesQuery = () =>
	queryOptions({
		queryKey: ["shows", "places"],
		queryFn: () => getPlaces("name", "asc"),
	});
export const placeListSort: SortListConfig<PlaceListResponse> = {
	sortOptions: { localKey: "show_place_list", defaultField: "name", defaultDirection: "asc" },
	queryKey: ["shows", "places"],
	queryFn: getPlaces,
};
async function getPlaceDetails(id: string, groupBySpectacle: boolean) {
	return fetchJson<PlaceDetailsResponse>(
		withQuery(`${API_BASE_URL}/show/places/${id}`, { groupBySpectacle: Boolean(groupBySpectacle) }),
	);
}
export const placeDetailsQuery = (id: string, groupBySpectacle: boolean) =>
	queryOptions({
		queryKey: ["shows", "places", id, groupBySpectacle],
		queryFn: () => getPlaceDetails(id, groupBySpectacle),
	});
export async function savePlace(data: any) {
	const sentData = SavePlaceBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/show/places/save`, "POST", sentData);
}
export async function deletePlace(id: string) {
	return sendJson(`${API_BASE_URL}/show/places/${id}`, "DELETE");
}

// MODEL
async function getModelDetails(id: string) {
	return fetchJson<ModelDetailsResponse>(`${API_BASE_URL}/show/models/${id}`);
}
export const modelDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["shows", "models", id],
		queryFn: () => getModelDetails(id),
	});
export async function saveModel(data: any) {
	const sentData = SaveModelBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/show/models/save`, "POST", sentData);
}
export async function deleteModel(id: string) {
	return sendJson(`${API_BASE_URL}/show/models/${id}`, "DELETE");
}

// WORK
async function getWorkDetails(id: string) {
	return fetchJson<WorkDetailsResponse>(`${API_BASE_URL}/show/works/${id}`);
}
export const workDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["shows", "works", id],
		queryFn: () => getWorkDetails(id),
	});
export async function saveWork(data: any) {
	const sentData = SaveWorkBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/show/works/save`, "POST", sentData);
}

// CASTING
export async function saveCasting(data: any) {
	const sentData = SaveCastingBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/show/performances/saveCasting`, "POST", sentData);
}

// PERFORMANCES
export async function savePerformance(data: any) {
	const sentData = SavePerformanceBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/show/performances/save`, "POST", sentData);
}

// MEDIA
export type MediaOwner = { spectacleId: number } | { artistId: number };
function mediaOwnerUrl(owner: MediaOwner) {
	return "artistId" in owner
		? `${API_BASE_URL}/show/media/artists/${owner.artistId}`
		: `${API_BASE_URL}/show/media/spectacles/${owner.spectacleId}`;
}
export const spectacleMediaQuery = (spectacleId: number, kind?: SpectacleMediaKind) =>
	queryOptions({
		queryKey: ["shows", "media", "spectacles", spectacleId, kind],
		queryFn: () => fetchJson<Array<SpectacleMedia>>(withQuery(mediaOwnerUrl({ spectacleId }), { kind })),
	});
export const artistMediaQuery = (artistId: number) =>
	queryOptions({
		queryKey: ["shows", "media", "artists", artistId],
		queryFn: () => fetchJson<Array<ArtistMedia>>(mediaOwnerUrl({ artistId })),
	});
export async function uploadMedia(owner: MediaOwner, data: unknown) {
	return sendJson(mediaOwnerUrl(owner), "POST", UploadMediaBodyRequestSchema.parse(data));
}
export async function updateMedia(owner: MediaOwner, mediaId: string, data: unknown) {
	return sendJson(`${mediaOwnerUrl(owner)}/${mediaId}`, "POST", UpdateMediaBodyRequestSchema.parse(data));
}
export async function reorderMedia(owner: MediaOwner, mediaIds: Array<string>) {
	return sendJson(`${mediaOwnerUrl(owner)}/order`, "POST", ReorderMediaBodyRequestSchema.parse({ mediaIds }));
}
export async function deleteMedia(owner: MediaOwner, mediaId: string) {
	return sendJson(`${mediaOwnerUrl(owner)}/${mediaId}`, "DELETE");
}

// REPORT
export async function getReport(from: string, to: string) {
	return fetchJson<GetReportResponse>(withQuery(`${API_BASE_URL}/show/reports`, { from, to }));
}
