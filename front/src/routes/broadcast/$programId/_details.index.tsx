import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/broadcast/$programId/_details/")({
	component: () => null,
});
