import { createFileRoute } from "@tanstack/react-router";

import { seriesListQuery } from "../../../modules/reading-book/api";
import SeriesList from "../../../modules/reading-book/pages/SeriesList";

export const Route = createFileRoute("/reading-book/series/_list")({
	loader: ({ context }) => context.queryClient.query({ ...seriesListQuery(), staleTime: "static" }),
	component: SeriesList,
});
