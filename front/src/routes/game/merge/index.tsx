import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { gamesQuery } from "../../../modules/game/api";
import Merge from "../../../modules/game/pages/Merge";

export const Route = createFileRoute("/game/merge/")({
	// the two games picked, in the URL: the duplicates panel links here with both
	validateSearch: z.object({ keepId: z.string().optional(), removeId: z.string().optional() }),
	loader: ({ context }) => context.queryClient.query({ ...gamesQuery(), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { keepId, removeId } = Route.useSearch();
	return <Merge keepId={keepId} removeId={removeId} />;
}
