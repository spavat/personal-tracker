import { createFileRoute } from "@tanstack/react-router";

import { monthQuery } from "../../../hooks/use-month-changer";
import { listeningHistory } from "../../../modules/music/api";
import History from "../../../modules/music/History";

export const Route = createFileRoute("/music/history/$period")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...monthQuery(listeningHistory, params.period), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { period } = Route.useParams();
	return <History period={period} />;
}
