import { createFileRoute } from "@tanstack/react-router";

import WorkList from "../../../modules/show/WorkList";

export const Route = createFileRoute("/shows/works/_list")({
	component: WorkList,
});
