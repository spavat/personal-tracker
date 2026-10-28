import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/modal-status";
import { placesQuery, spectacleDetailsQuery, spectaclesQuery } from "../../../../modules/show/api";
import PerformanceModalForm from "../../../../modules/show/modals/PerformanceModalForm";
import { withReturnToSchema } from "../../../../router/searchParams";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details/addPerformance")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...spectacleDetailsQuery(params.spectacleId), staleTime: "static" }),
			context.queryClient.query({ ...spectaclesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...placesQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { spectacleId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <PerformanceModalForm spectacleId={spectacleId} returnTo={returnTo} />;
}
