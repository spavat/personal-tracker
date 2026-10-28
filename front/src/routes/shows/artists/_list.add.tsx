import { createFileRoute } from "@tanstack/react-router";

import ArtistModalForm from "../../../modules/show/modals/ArtistModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/shows/artists/_list/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <ArtistModalForm returnTo={returnTo} />;
}
