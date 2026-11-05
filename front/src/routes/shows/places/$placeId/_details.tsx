import { createFileRoute } from "@tanstack/react-router";

import { readStoredValue } from "../../../../hooks/stored-value";
import { placeDetailsQuery } from "../../../../modules/show/api";
import PlaceDetails from "../../../../modules/show/pages/PlaceDetails";

export const Route = createFileRoute("/shows/places/$placeId/_details")({
	loader: ({ context, params }) =>
		context.queryClient.query({
			...placeDetailsQuery(params.placeId, readStoredValue("show_place_details_groupBySpectacle", false)),
			staleTime: "static",
		}),
	component: RouteComponent,
});

function RouteComponent() {
	const { placeId } = Route.useParams();
	return <PlaceDetails placeId={placeId} />;
}
