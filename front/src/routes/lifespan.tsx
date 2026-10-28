import { createFileRoute } from "@tanstack/react-router";

import AppLifespan from "../modules/lifespan";

export const Route = createFileRoute("/lifespan")({
	component: AppLifespan,
});
