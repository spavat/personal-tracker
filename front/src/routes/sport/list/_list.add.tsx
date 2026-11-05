import { createFileRoute } from "@tanstack/react-router";

import ActivityModalForm from "../../../modules/sport/modals/ActivityModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/sport/list/_list/add")({
	staticData: { modal: true },
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <ActivityModalForm returnTo={returnTo} />;
}
