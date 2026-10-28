import { createFileRoute } from "@tanstack/react-router";

import MainDashboard from "../dashboard/MainDashboard";

export const Route = createFileRoute("/")({
	component: MainDashboard,
});
