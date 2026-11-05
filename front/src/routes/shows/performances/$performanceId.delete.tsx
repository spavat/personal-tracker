import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { performanceDetailsQuery } from "../../../modules/show/api";
import DeletePerformanceModalForm from "../../../modules/show/modals/DeletePerformanceModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/shows/performances/$performanceId/delete")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		context.queryClient.query({ ...performanceDetailsQuery(params.performanceId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { performanceId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeletePerformanceModalForm performanceId={performanceId} returnTo={returnTo} />;
}
