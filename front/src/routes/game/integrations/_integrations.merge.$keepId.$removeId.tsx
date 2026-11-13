import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { gameDetailsQuery } from "../../../modules/game/api";
import MergeGamesModal from "../../../modules/game/modals/MergeGamesModal";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/game/integrations/_integrations/merge/$keepId/$removeId")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...gameDetailsQuery(params.keepId), staleTime: "static" }),
			context.queryClient.query({ ...gameDetailsQuery(params.removeId), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { keepId, removeId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <MergeGamesModal keepId={keepId} removeId={removeId} returnTo={returnTo} />;
}
