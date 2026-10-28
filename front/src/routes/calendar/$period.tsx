import { createFileRoute } from "@tanstack/react-router";

import { monthQuery } from "../../hooks/use-month-changer";
import { monthCalendar } from "../../modules/calendar/api";
import Calendar from "../../modules/calendar/Calendar";

export const Route = createFileRoute("/calendar/$period")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...monthQuery(monthCalendar, params.period), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { period } = Route.useParams();
	return <Calendar period={period} />;
}
