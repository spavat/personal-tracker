import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details/")({
	component: () => null,
});
