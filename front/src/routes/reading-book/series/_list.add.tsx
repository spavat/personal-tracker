import { createFileRoute } from "@tanstack/react-router";

import SeriesForm from "../../../modules/reading-book/forms/SeriesForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/reading-book/series/_list/add")({
	staticData: { modal: true },
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <SeriesForm returnTo={returnTo} />;
}
