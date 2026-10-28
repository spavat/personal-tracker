import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { placeListSort } from "../../../modules/show/api";
import PlaceList from "../../../modules/show/PlaceList";

export const Route = createFileRoute("/shows/places/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(placeListSort), staleTime: "static" }),
	component: PlaceList,
});
