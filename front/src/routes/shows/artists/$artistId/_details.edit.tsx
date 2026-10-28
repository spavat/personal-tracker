import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/modal-status";
import { artistDetailsQuery } from "../../../../modules/show/api";
import ArtistModalForm from "../../../../modules/show/modals/ArtistModalForm";
import { withReturnToSchema } from "../../../../router/searchParams";

export const Route = createFileRoute("/shows/artists/$artistId/_details/edit")({
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
	return <ArtistModalForm artistId={artistId} returnTo={returnTo} />;
}
