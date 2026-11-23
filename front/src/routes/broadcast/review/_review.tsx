import { createFileRoute } from "@tanstack/react-router";

import { reviewQuery } from "../../../modules/broadcast/api";
import Review from "../../../modules/broadcast/pages/Review";

export const Route = createFileRoute("/broadcast/review/_review")({
	loader: ({ context }) => context.queryClient.query({ ...reviewQuery(), staleTime: "static" }),
	component: Review,
});
