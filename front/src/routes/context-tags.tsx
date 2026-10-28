import { createFileRoute } from "@tanstack/react-router";

import AppContextTags from "../modules/context-tags";

export const Route = createFileRoute("/context-tags")({
	component: AppContextTags,
});
