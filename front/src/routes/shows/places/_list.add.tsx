import { createFileRoute } from "@tanstack/react-router";

import PlaceModalForm from "../../../modules/show/modals/PlaceModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/shows/places/_list/add")({
	staticData: { modal: true },
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <PlaceModalForm returnTo={returnTo} />;
}
