import { createFileRoute } from "@tanstack/react-router";

import AppBroadcast from "../modules/broadcast";

export const Route = createFileRoute("/broadcast")({
	component: AppBroadcast,
});
