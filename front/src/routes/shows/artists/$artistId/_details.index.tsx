import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shows/artists/$artistId/_details/")({
	component: () => null,
});
