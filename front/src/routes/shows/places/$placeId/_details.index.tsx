import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shows/places/$placeId/_details/")({
	component: () => null,
});
