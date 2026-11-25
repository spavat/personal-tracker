import { createFileRoute } from "@tanstack/react-router";

import AppEntities from "../modules/entities";

export const Route = createFileRoute("/entities")({
	component: AppEntities,
});
