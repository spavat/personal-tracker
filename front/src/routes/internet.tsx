import { createFileRoute } from "@tanstack/react-router";

import AppInternet from "../modules/internet";

export const Route = createFileRoute("/internet")({
	component: AppInternet,
});
