import { createFileRoute } from "@tanstack/react-router";

import MangaModalForm from "../../../modules/reading-manga/modals/MangaModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/reading-manga/list/_list/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <MangaModalForm returnTo={returnTo} />;
}
