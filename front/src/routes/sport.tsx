import { createFileRoute } from "@tanstack/react-router";

import AppSport from "../modules/sport";

export const Route = createFileRoute("/sport")({
	component: AppSport,
});
