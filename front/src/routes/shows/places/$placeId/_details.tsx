import { createFileRoute } from "@tanstack/react-router";

import PlaceDetails from "../../../../modules/show/PlaceDetails";

export const Route = createFileRoute("/shows/places/$placeId/_details")({
	component: RouteComponent,
});

function RouteComponent() {
	const { placeId } = Route.useParams();
	return <PlaceDetails placeId={placeId} />;
}
