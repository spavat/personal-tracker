import { createFileRoute } from "@tanstack/react-router";

import { yearQuery } from "../../../hooks/use-year-changer";
import { bookHistory } from "../../../modules/reading-book/api";
import History from "../../../modules/reading-book/History";

export const Route = createFileRoute("/reading-book/history/$year")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...yearQuery(bookHistory, params.year), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { year } = Route.useParams();
	return <History year={year} />;
}
