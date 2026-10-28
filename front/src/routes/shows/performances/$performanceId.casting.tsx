import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { artistsQuery, performanceDetailsQuery } from "../../../modules/show/api";
import CastingModalForm from "../../../modules/show/modals/CastingModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/shows/performances/$performanceId/casting")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...performanceDetailsQuery(params.performanceId), staleTime: "static" }),
			context.queryClient.query({ ...artistsQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { performanceId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <CastingModalForm performanceId={performanceId} returnTo={returnTo} />;
}
