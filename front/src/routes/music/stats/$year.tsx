import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import { musicStats } from "../../../modules/music/api";
import Stats from "../../../modules/music/Stats";

export const Route = createFileRoute("/music/stats/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(musicStats, params.year), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { year } = Route.useParams();
	return <Stats year={year} />;
}
