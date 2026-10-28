import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { gameListSort } from "../../../modules/game/api";
import List from "../../../modules/game/List";

export const Route = createFileRoute("/game/list/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(gameListSort), staleTime: "static" }),
	component: List,
});
