import { createFileRoute } from "@tanstack/react-router";

import ProgramModalForm from "../../../modules/internet/modals/ProgramModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/internet/list/_list/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <ProgramModalForm returnTo={returnTo} />;
}
