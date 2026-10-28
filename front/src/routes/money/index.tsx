import { createFileRoute } from "@tanstack/react-router";

import { banksOverviewQuery } from "../../modules/money/api";
import MoneyOverview from "../../modules/money/Overview";

export const Route = createFileRoute("/money/")({
	loader: ({ context }) => context.queryClient.query({ ...banksOverviewQuery(), staleTime: "static" }),
	component: MoneyOverview,
});
