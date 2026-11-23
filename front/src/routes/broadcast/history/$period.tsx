import { createFileRoute } from "@tanstack/react-router";

import { monthQuery } from "../../../hooks/use-month-changer";
import { programHistory } from "../../../modules/broadcast/api";
import History from "../../../modules/broadcast/pages/History";

export const Route = createFileRoute("/broadcast/history/$period")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...monthQuery(programHistory, params.period), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { period } = Route.useParams();
	return <History period={period} />;
}
