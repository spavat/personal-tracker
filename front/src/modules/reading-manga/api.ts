import {
	Manga,
	// SaveMangaRequestSchema,
	ListMangaOverview,
	MangaOverview,
	SaveBodyRequestType,
	SaveBodyRequestSchema,
} from "@personal-tracker/shared/reading-manga";
import { queryOptions } from "@tanstack/react-query";

import type { SortListConfig } from "../../hooks/use-sort-table";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

export async function getMangas({
	from,
	to,
	search,
	sortField,
	sortDirection,
	withReadings,
}: {
	from?: string;
	to?: string;
	search?: string;
	sortField?: string;
	sortDirection?: string;
	withReadings?: boolean;
} = {}) {
	return fetchJson<ListMangaOverview>(
		withQuery(`${API_BASE_URL}/reading-manga/mangas`, {
			from,
			to,
			search,
			sort: sortField && sortDirection ? [sortField, sortDirection] : undefined,
			withReadings: withReadings || undefined,
		}),
	);
}
export const mangaHistory: YearQueryConfig<ListMangaOverview> = {
	queryKey: ["reading", "mangas"],
	queryFn: (start: string, end: string) =>
		getMangas({
			from: start,
			to: end,
			sortField: "lastReadingDate",
			sortDirection: "desc",
			withReadings: true,
		}),
};
export const mangaListSort: SortListConfig<MangaOverview> = {
	sortOptions: { localKey: "reading_manga_list", defaultField: "title", defaultDirection: "asc" },
	queryKey: ["reading", "mangas"],
	queryFn: (sortField: string, sortDirection: string) => getMangas({ sortField, sortDirection }),
};

async function getMangaDetails(id: string) {
	return fetchJson<Manga>(`${API_BASE_URL}/reading-manga/mangas/${id}`);
}
export const mangaDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["reading", "manga", id],
		queryFn: () => getMangaDetails(id),
	});

// export async function saveManga(data: any) {
// 	const dataToSend = SaveMangaRequestSchema.parse(data);
// 	const response = await fetch(`${API_BASE_URL}/reading-manga/save`, {
// 		method: "POST",
// 		headers: {
// 			"Content-Type": "application/json",
// 		},
// 		body: JSON.stringify(dataToSend),
// 	});
// 	if (!response.ok) {
// 		const result = await response.json();
// 		throw new Error(result.message);
// 	}
// 	const result = await response.json();
// 	return result;
// }

export async function save(data: SaveBodyRequestType) {
	const sentData = SaveBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/reading-manga/save`, "POST", sentData);
}

export async function deleteReading({ id, readingId }: { id: string; readingId: string }) {
	return sendJson(`${API_BASE_URL}/reading-manga/mangas/${id}/readings/${readingId}`, "DELETE");
}
