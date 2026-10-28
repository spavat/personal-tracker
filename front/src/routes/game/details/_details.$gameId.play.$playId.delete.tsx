import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { gameDetailsQuery } from "../../../modules/game/api";
import DeletePlayModalForm from "../../../modules/game/modals/DeletePlayModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/game/details/_details/$gameId/play/$playId/delete")({
	loader: async ({ context, params }) => {
		const game = await context.queryClient.query({ ...gameDetailsQuery(params.gameId), staleTime: "static" });
		if (!game.plays.some((play) => play.id === params.playId)) {
			throw new Error("Partie introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { gameId, playId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeletePlayModalForm gameId={gameId} playId={playId} returnTo={returnTo} />;
}
