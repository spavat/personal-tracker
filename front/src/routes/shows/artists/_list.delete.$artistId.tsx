import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { artistDetailsQuery } from "../../../modules/show/api";
import DeleteArtistModalForm from "../../../modules/show/modals/DeleteArtistModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/shows/artists/_list/delete/$artistId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...artistDetailsQuery(params.artistId, false), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { artistId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteArtistModalForm artistId={artistId} returnTo={returnTo} />;
}
