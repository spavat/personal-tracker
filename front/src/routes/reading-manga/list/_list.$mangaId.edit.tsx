import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { mangaDetailsQuery } from "../../../modules/reading-manga/api";
import MangaModalForm from "../../../modules/reading-manga/modals/MangaModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/reading-manga/list/_list/$mangaId/edit")({
	staticData: { modal: true },
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
