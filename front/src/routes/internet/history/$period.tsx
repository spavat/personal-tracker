import { createFileRoute } from "@tanstack/react-router";

import { monthQuery } from "../../../hooks/use-month-changer";
import { programHistory } from "../../../modules/internet/api";
import History from "../../../modules/internet/History";

export const Route = createFileRoute("/internet/history/$period")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...monthQuery(programHistory, params.period), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { period } = Route.useParams();
	return <History period={period} />;
}
