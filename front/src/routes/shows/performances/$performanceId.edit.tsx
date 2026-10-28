import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { performanceDetailsQuery, placesQuery, spectaclesQuery } from "../../../modules/show/api";
import PerformanceModalForm from "../../../modules/show/modals/PerformanceModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/shows/performances/$performanceId/edit")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...performanceDetailsQuery(params.performanceId), staleTime: "static" }),
			context.queryClient.query({ ...spectaclesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...placesQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	const { performanceId } = Route.useParams();
	return <PerformanceModalForm performanceId={performanceId} returnTo={returnTo} />;
}
