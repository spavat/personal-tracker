import { createFileRoute } from "@tanstack/react-router";

import { reviewQuery } from "../../../modules/internet/api";
import Review from "../../../modules/internet/pages/Review";

export const Route = createFileRoute("/internet/review/_review")({
	loader: ({ context }) => context.queryClient.query({ ...reviewQuery(), staleTime: "static" }),
	component: Review,
});
