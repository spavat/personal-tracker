import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { listeningDetailsQuery } from "../../../modules/music/api";
import EditListeningModalForm from "../../../modules/music/modals/EditListeningModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/music/list/$period/$listeningId/edit")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		context.queryClient.query({ ...listeningDetailsQuery(params.listeningId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { listeningId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EditListeningModalForm listeningId={listeningId} returnTo={returnTo} />;
}
