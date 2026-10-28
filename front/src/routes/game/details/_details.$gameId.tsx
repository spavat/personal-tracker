import { createFileRoute } from "@tanstack/react-router";

import { gameDetailsQuery } from "../../../modules/game/api";
import GameDetails from "../../../modules/game/Details";

export const Route = createFileRoute("/game/details/_details/$gameId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...gameDetailsQuery(params.gameId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { gameId } = Route.useParams();
	return <GameDetails gameId={gameId} />;
}
