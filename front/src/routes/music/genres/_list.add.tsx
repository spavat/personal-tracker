import { createFileRoute } from "@tanstack/react-router";

import GenreModalForm from "../../../modules/music/modals/GenreModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/music/genres/_list/add")({
	staticData: { modal: true },
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <GenreModalForm returnTo={returnTo} />;
}
