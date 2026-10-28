import { createFileRoute } from "@tanstack/react-router";

import AppCalendar from "../modules/calendar";

export const Route = createFileRoute("/calendar")({
	component: RouteComponent,
});

function RouteComponent() {
	return <AppCalendar />;
}
