import { createFileRoute } from "@tanstack/react-router";

import ArtistDetails from "../../../../modules/show/ArtistDetails";

export const Route = createFileRoute("/shows/artists/$artistId/_details")({
	component: RouteComponent,
});

function RouteComponent() {
	const { artistId } = Route.useParams();
	return <ArtistDetails artistId={artistId} />;
}
