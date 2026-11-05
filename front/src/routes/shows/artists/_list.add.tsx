import { createFileRoute } from "@tanstack/react-router";

import ArtistModalForm from "../../../modules/show/modals/ArtistModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/shows/artists/_list/add")({
	staticData: { modal: true },
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <ArtistModalForm returnTo={returnTo} />;
}
