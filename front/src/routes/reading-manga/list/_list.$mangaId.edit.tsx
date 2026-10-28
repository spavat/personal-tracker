import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { mangaDetailsQuery } from "../../../modules/reading-manga/api";
import MangaModalForm from "../../../modules/reading-manga/modals/MangaModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/reading-manga/list/_list/$mangaId/edit")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...mangaDetailsQuery(params.mangaId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { mangaId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <MangaModalForm mangaId={mangaId} returnTo={returnTo} />;
}
