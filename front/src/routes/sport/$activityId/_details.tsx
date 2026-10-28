import { createFileRoute } from "@tanstack/react-router";

import { activityDetailsQuery } from "../../../modules/sport/api";
import ActivityDetails from "../../../modules/sport/pages/ActivityDetails";

export const Route = createFileRoute("/sport/$activityId/_details")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...activityDetailsQuery(params.activityId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { activityId } = Route.useParams();
	return <ActivityDetails activityId={activityId} />;
}
