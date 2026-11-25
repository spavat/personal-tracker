import { createFileRoute } from "@tanstack/react-router";

import { watchlistQuery } from "../../../modules/broadcast/api";
import Watchlist from "../../../modules/broadcast/pages/Watchlist";

export const Route = createFileRoute("/broadcast/watchlist/")({
	loader: ({ context }) => context.queryClient.query({ ...watchlistQuery(), staleTime: "static" }),
	component: Watchlist,
});
