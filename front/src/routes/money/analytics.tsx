import { createFileRoute } from "@tanstack/react-router";

import { readStoredValue } from "../../hooks/stored-value";
import MoneyAnalytics from "../../modules/money/Analytics";
import { analyticsQuery, SPLIT_PARENT_STORAGE } from "../../modules/money/api";

export const Route = createFileRoute("/money/analytics")({
	loader: ({ context }) =>
		context.queryClient.query({
			...analyticsQuery(readStoredValue(SPLIT_PARENT_STORAGE.key, SPLIT_PARENT_STORAGE.defaultValue)),
			staleTime: "static",
		}),
	component: MoneyAnalytics,
});
