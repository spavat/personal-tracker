import {
	Author,
	AuthorDetails,
	Book,
	BookOverview,
	GetReportResponse,
	SaveBookModelRequest,
	SaveBookRequestSchema,
	SaveBookResponse,
	SaveEditionRequest,
	SaveEditionRequestSchema,
	SaveSeriesRequest,
	Series,
	SeriesDetails,
} from "@personal-tracker/shared/reading-book";
import { queryOptions } from "@tanstack/react-query";

import type { SortListConfig } from "../../hooks/use-sort-table";
import type { YearQueryConfig } from "../../hooks/use-year-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

export async function getBooks({
	from,
	to,
	search,
	sortField,
	sortDirection,
	withReadingsDetails,
}: {
	from?: string;
	to?: string;
	search?: string;
	sortField?: string;
	sortDirection?: string;
	withReadingsDetails?: boolean;
} = {}) {
	return fetchJson<Array<BookOverview>>(
		withQuery(`${API_BASE_URL}/reading-book/books`, {
			from,
			to,
			search,
			sort: sortField && sortDirection ? [sortField, sortDirection] : undefined,
			withReadingsDetails: withReadingsDetails || undefined,
		}),
	);
}
export const bookHistory: YearQueryConfig<Array<BookOverview>> = {
	queryKey: ["reading", "books"],
	queryFn: (start: string, end: string) => getBooks({ from: start, to: end }),
};
export const bookListSort: SortListConfig<BookOverview> = {
	sortOptions: { localKey: "reading_book_list", defaultField: "book", defaultDirection: "asc" },
	queryKey: ["reading", "books"],
	queryFn: (sortField: string, sortDirection: string) => getBooks({ sortField, sortDirection }),
};

async function getBookDetails(id: string) {
	return fetchJson<Book>(`${API_BASE_URL}/reading-book/books/${id}`);
}
export const bookDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["reading", "books", id],
		queryFn: () => getBookDetails(id),
	});

export const authorsQuery = () =>
	queryOptions({
		queryKey: ["reading", "authors"],
		queryFn: () => fetchJson<Author[]>(`${API_BASE_URL}/reading-book/authors`),
	});

export const authorDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["reading", "authors", id],
		queryFn: () => fetchJson<AuthorDetails>(`${API_BASE_URL}/reading-book/authors/${id}`),
	});

export const seriesListQuery = () =>
	queryOptions({
		queryKey: ["reading", "series"],
		queryFn: () => fetchJson<Series[]>(`${API_BASE_URL}/reading-book/series`),
	});

export const seriesDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["reading", "series", id],
		queryFn: () => fetchJson<SeriesDetails>(`${API_BASE_URL}/reading-book/series/${id}`),
	});

// every book, by title: the series form picks among them
export const allBooksQuery = () =>
	queryOptions({
		queryKey: ["reading", "books", "all"],
		queryFn: () => getBooks({ sortField: "book", sortDirection: "asc" }),
	});

export async function saveSeries(series: SaveSeriesRequest) {
	return sendJson<{ id: string }>(`${API_BASE_URL}/reading-book/series/save`, "POST", series);
}

export async function deleteSeries(id: string) {
	return sendJson(`${API_BASE_URL}/reading-book/series/${id}`, "DELETE");
}

export async function getReport({ from, to }: { from: string; to: string }) {
	return fetchJson<GetReportResponse>(withQuery(`${API_BASE_URL}/reading-book/reports`, { from, to }));
}

export async function saveBook(data: any) {
	const dataToSend = SaveBookRequestSchema.parse(data);
	return sendJson<SaveBookResponse>(`${API_BASE_URL}/reading-book/save`, "POST", dataToSend);
}

export async function saveModel({ id, model }: { id: string; model: SaveBookModelRequest }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/models/save`, "POST", model);
}

export async function deleteModel({ id, modelId }: { id: string; modelId: string }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/models/${modelId}`, "DELETE");
}

export async function saveEdition({ id, edition }: { id: string; edition: SaveEditionRequest }) {
	const dataToSend = SaveEditionRequestSchema.parse(edition);
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/editions/save`, "POST", dataToSend);
}

export async function deleteEdition({ id, editionId }: { id: string; editionId: string }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/editions/${editionId}`, "DELETE");
}

export async function addReading({ id, editionId }: { id: string; editionId: string }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/editions/${editionId}/readings`, "POST");
}

export async function saveReading({ id, reading }: { id: string; reading: any }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/saveReading`, "POST", reading);
}

export async function deleteReading({ id, readingId }: { id: string; readingId: string }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/readings/${readingId}`, "DELETE");
}
