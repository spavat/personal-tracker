import { createFileRoute } from "@tanstack/react-router";

import PublicHome from "../../dashboard/PublicHome";

export const Route = createFileRoute("/_home/")({
	component: PublicHome,
});
