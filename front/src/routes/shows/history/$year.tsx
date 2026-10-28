import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import { performanceHistory } from "../../../modules/show/api";
import History from "../../../modules/show/History";

export const Route = createFileRoute("/shows/history/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(performanceHistory, params.year), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { year } = Route.useParams();
	return <History year={year} />;
}
