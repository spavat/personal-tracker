import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { bookListSort } from "../../../modules/reading-book/api";
import BookList from "../../../modules/reading-book/pages/BookList";

export const Route = createFileRoute("/reading-book/list/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(bookListSort), staleTime: "static" }),
	component: BookList,
});
