import { createFileRoute } from "@tanstack/react-router";

import MainReports from "../reports/MainReports";

export const Route = createFileRoute("/reports")({
	component: MainReports,
});
