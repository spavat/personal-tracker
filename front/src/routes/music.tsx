import { createFileRoute } from "@tanstack/react-router";

import AppMusic from "../modules/music";

export const Route = createFileRoute("/music")({
	component: AppMusic,
});
