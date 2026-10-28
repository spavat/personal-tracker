import { createFileRoute } from "@tanstack/react-router";

import { monthQuery } from "../../../hooks/use-month-changer";
import { listeningHistory } from "../../../modules/music/api";
import List from "../../../modules/music/List";

export const Route = createFileRoute("/music/list/$period")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...monthQuery(listeningHistory, params.period), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { period } = Route.useParams();
	return <List period={period} />;
}
