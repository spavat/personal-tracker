import { createFileRoute } from "@tanstack/react-router";

import { performancesQuery } from "../../../modules/show/api";
import PerformanceList from "../../../modules/show/PerformanceList";

export const Route = createFileRoute("/shows/performances/")({
	loader: ({ context }) => context.queryClient.query({ ...performancesQuery(), staleTime: "static" }),
	component: PerformanceList,
});
