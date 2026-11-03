import { createFileRoute } from "@tanstack/react-router";

import WorkModalForm from "../../../modules/show/modals/WorkModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/shows/works/_list/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <WorkModalForm returnTo={returnTo} />;
}
