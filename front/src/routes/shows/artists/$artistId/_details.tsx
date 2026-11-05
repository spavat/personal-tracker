import { createFileRoute } from "@tanstack/react-router";

import { readStoredValue } from "../../../../hooks/stored-value";
import { artistDetailsQuery } from "../../../../modules/show/api";
import ArtistDetails from "../../../../modules/show/pages/ArtistDetails";

export const Route = createFileRoute("/shows/artists/$artistId/_details")({
	loader: ({ context, params }) =>
		context.queryClient.query({
			...artistDetailsQuery(params.artistId, readStoredValue("show_artist_details_groupBySpectacle", false)),
			staleTime: "static",
		}),
	component: RouteComponent,
});

function RouteComponent() {
	const { artistId } = Route.useParams();
	return <ArtistDetails artistId={artistId} />;
}
