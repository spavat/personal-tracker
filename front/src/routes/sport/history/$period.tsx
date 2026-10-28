import { createFileRoute } from "@tanstack/react-router";

import { monthQuery } from "../../../hooks/use-month-changer";
import { activityHistory } from "../../../modules/sport/api";
import History from "../../../modules/sport/pages/History";

export const Route = createFileRoute("/sport/history/$period")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...monthQuery(activityHistory, params.period), staleTime: "static" }),
	component: RouteComponent,
});
function RouteComponent() {
	const { period } = Route.useParams();
	return <History period={period} />;
}
