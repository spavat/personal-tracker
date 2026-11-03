import { createFileRoute } from "@tanstack/react-router";

import SpectacleList from "../../../modules/show/pages/SpectacleList";

export const Route = createFileRoute("/shows/spectacles/")({
	component: SpectacleList,
});
