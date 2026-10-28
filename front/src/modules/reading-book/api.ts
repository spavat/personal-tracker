import {
	Book,
	BookOverview,
	GetReportResponse,
	SaveBookRequestSchema,
	SaveBookResponse,
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

export async function getReport({ from, to }: { from: string; to: string }) {
	return fetchJson<GetReportResponse>(withQuery(`${API_BASE_URL}/reading-book/reports`, { from, to }));
}

export async function saveBook(data: any) {
	const dataToSend = SaveBookRequestSchema.parse(data);
	return sendJson<SaveBookResponse>(`${API_BASE_URL}/reading-book/save`, "POST", dataToSend);
}

export async function saveModel({ id, model }: { id: string; model: any }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/saveModel`, "POST", model);
}

export async function addReading({ id }: { id: string }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/readings`, "POST");
}

export async function saveReading({ id, reading }: { id: string; reading: any }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/saveReading`, "POST", reading);
}

export async function deleteReading({ id, readingId }: { id: string; readingId: string }) {
	return sendJson(`${API_BASE_URL}/reading-book/books/${id}/readings/${readingId}`, "DELETE");
}
