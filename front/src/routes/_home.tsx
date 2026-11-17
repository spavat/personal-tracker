import { createFileRoute } from "@tanstack/react-router";

import AppHome from "../modules/home";

export const Route = createFileRoute("/_home")({
	component: AppHome,
});
