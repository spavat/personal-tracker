import { createFileRoute } from "@tanstack/react-router";

import WorkList from "../../../modules/show/pages/WorkList";

export const Route = createFileRoute("/shows/works/_list")({
	component: WorkList,
});
