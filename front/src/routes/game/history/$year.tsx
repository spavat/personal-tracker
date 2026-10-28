import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import { playHistory } from "../../../modules/game/api";
import History from "../../../modules/game/History";

export const Route = createFileRoute("/game/history/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(playHistory, params.year), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { year } = Route.useParams();
	return <History year={year} />;
}
