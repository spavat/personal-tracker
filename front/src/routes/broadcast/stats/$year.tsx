import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import { broadcastStats } from "../../../modules/broadcast/api";
import Stats from "../../../modules/broadcast/pages/Stats";

export const Route = createFileRoute("/broadcast/stats/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(broadcastStats, params.year), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { year } = Route.useParams();
	return <Stats year={year} />;
}
