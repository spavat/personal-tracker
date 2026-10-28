import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { bookListSort } from "../../../modules/reading-book/api";
import List from "../../../modules/reading-book/List";

export const Route = createFileRoute("/reading-book/list/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(bookListSort), staleTime: "static" }),
	component: List,
});
