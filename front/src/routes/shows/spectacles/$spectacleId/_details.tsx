import { createFileRoute } from "@tanstack/react-router";

import { spectacleDetailsQuery } from "../../../../modules/show/api";
import SpectacleDetails from "../../../../modules/show/SpectacleDetails";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...spectacleDetailsQuery(params.spectacleId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { spectacleId } = Route.useParams();
	return <SpectacleDetails spectacleId={spectacleId} />;
}
