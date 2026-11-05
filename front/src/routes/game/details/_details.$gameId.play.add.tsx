import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { gamesQuery } from "../../../modules/game/api";
import AddPlayModalForm from "../../../modules/game/modals/AddPlayModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/game/details/_details/$gameId/play/add")({
	staticData: { modal: true },
	loader: ({ context }) => context.queryClient.query({ ...gamesQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { gameId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <AddPlayModalForm gameId={gameId} returnTo={returnTo} />;
}
