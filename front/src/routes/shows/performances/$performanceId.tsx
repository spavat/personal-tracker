import { createFileRoute } from "@tanstack/react-router";

import { performanceDetailsQuery } from "../../../modules/show/api";
import PerformanceDetails from "../../../modules/show/PerformanceDetails";

export const Route = createFileRoute("/shows/performances/$performanceId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...performanceDetailsQuery(params.performanceId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { performanceId } = Route.useParams();
	return <PerformanceDetails performanceId={performanceId} />;
}
