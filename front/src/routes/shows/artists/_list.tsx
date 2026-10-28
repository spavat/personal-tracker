import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { artistListSort } from "../../../modules/show/api";
import ArtistList from "../../../modules/show/ArtistList";

export const Route = createFileRoute("/shows/artists/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(artistListSort), staleTime: "static" }),
	component: ArtistList,
});
