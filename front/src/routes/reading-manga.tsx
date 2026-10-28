import { createFileRoute } from "@tanstack/react-router";

import AppReadingManga from "../modules/reading-manga";

export const Route = createFileRoute("/reading-manga")({
	component: AppReadingManga,
});
