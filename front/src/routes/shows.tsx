import { createFileRoute } from "@tanstack/react-router";

import AppShows from "../modules/show";

export const Route = createFileRoute("/shows")({
	component: AppShows,
});
