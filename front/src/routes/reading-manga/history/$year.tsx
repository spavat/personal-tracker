import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import { mangaHistory } from "../../../modules/reading-manga/api";
import History from "../../../modules/reading-manga/pages/History";

export const Route = createFileRoute("/reading-manga/history/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(mangaHistory, params.year), staleTime: "static" }),
	component: RouteComponent,
});
function RouteComponent() {
	const { year } = Route.useParams();
	return <History year={year} />;
}
