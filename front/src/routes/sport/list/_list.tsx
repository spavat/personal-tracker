import { createFileRoute } from "@tanstack/react-router";

import { allActivitiesQuery } from "../../../modules/sport/api";
import List from "../../../modules/sport/pages/List";

export const Route = createFileRoute("/sport/list/_list")({
	loader: ({ context }) => context.queryClient.query({ ...allActivitiesQuery(), staleTime: "static" }),
	component: List,
});
