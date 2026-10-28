import { createFileRoute } from "@tanstack/react-router";

import EditReadingModalForm from "../../../modules/reading-manga/modals/EditReadingModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/reading-manga/manga/$mangaId/reading/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { mangaId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EditReadingModalForm mangaId={mangaId} returnTo={returnTo} />;
}
