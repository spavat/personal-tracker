import { createFileRoute } from "@tanstack/react-router";

import ContextTagModalForm from "../../modules/context-tags/modals/ContextTagModalForm";
import { withReturnToSchema } from "../../router/searchParams";

export const Route = createFileRoute("/context-tags/_list/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <ContextTagModalForm returnTo={returnTo} />;
}
