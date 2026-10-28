import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../components/modal-status";
import { dailyCalendarQuery } from "../../modules/calendar/api";
import DetailsDay from "../../modules/calendar/DetailsDay";
import { withReturnToSchema } from "../../router/searchParams";

export const Route = createFileRoute("/calendar/$period/$date")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...dailyCalendarQuery(params.date), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { period, date } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DetailsDay period={period} date={date} returnTo={returnTo} />;
}
