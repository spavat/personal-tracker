import { createFileRoute } from "@tanstack/react-router";

import AppGame from "../modules/game";

export const Route = createFileRoute("/game")({
	component: AppGame,
});
