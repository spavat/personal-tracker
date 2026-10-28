import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { gameDetailsQuery } from "../../../modules/game/api";
import GameModalForm from "../../../modules/game/modals/GameModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/game/list/_list/$gameId/edit")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...gameDetailsQuery(params.gameId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { gameId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <GameModalForm gameId={gameId} returnTo={returnTo} />;
}
