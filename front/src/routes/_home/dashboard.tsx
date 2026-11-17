import { createFileRoute } from "@tanstack/react-router";

import MainDashboard from "../../dashboard/MainDashboard";

export const Route = createFileRoute("/_home/dashboard")({
	component: MainDashboard,
});
