import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import { internetStats } from "../../../modules/internet/api";
import Stats from "../../../modules/internet/Stats";

export const Route = createFileRoute("/internet/stats/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(internetStats, params.year), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { year } = Route.useParams();
	return <Stats year={year} />;
}
