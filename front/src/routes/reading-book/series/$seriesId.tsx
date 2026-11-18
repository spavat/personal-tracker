import { createFileRoute } from "@tanstack/react-router";

import { seriesDetailsQuery } from "../../../modules/reading-book/api";
import SeriesDetails from "../../../modules/reading-book/pages/SeriesDetails";

export const Route = createFileRoute("/reading-book/series/$seriesId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...seriesDetailsQuery(params.seriesId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { seriesId } = Route.useParams();
	return <SeriesDetails seriesId={seriesId} />;
}
