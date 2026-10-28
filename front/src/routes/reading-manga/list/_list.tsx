import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { mangaListSort } from "../../../modules/reading-manga/api";
import List from "../../../modules/reading-manga/pages/List";

export const Route = createFileRoute("/reading-manga/list/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(mangaListSort), staleTime: "static" }),
	component: List,
});
