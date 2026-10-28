import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { programListSort } from "../../../modules/internet/api";
import List from "../../../modules/internet/List";

export const Route = createFileRoute("/internet/list/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(programListSort), staleTime: "static" }),
	component: List,
});
