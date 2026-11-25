import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/entities/$entityId/_details/")({
	component: () => null,
});
