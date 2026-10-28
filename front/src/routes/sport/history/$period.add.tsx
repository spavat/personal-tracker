import { createFileRoute } from "@tanstack/react-router";

import ActivityModalForm from "../../../modules/sport/modals/ActivityModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/sport/history/$period/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <ActivityModalForm returnTo={returnTo} />;
}
