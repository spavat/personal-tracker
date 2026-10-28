import { createFileRoute } from "@tanstack/react-router";

import GenreModalForm from "../../../modules/music/genres/modals/GenreModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/music/genres/_list/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <GenreModalForm returnTo={returnTo} />;
}
