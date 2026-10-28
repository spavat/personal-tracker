import { createFileRoute } from "@tanstack/react-router";

import { activityDetailsQuery } from "../../../modules/sport/api";
import CropTrace from "../../../modules/sport/pages/ActivityDetails/CropTrace";

export const Route = createFileRoute("/sport/$activityId/crop")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...activityDetailsQuery(params.activityId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { activityId } = Route.useParams();
	return <CropTrace activityId={activityId} />;
}
