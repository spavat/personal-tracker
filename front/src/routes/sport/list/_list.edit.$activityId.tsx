import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { activityDetailsQuery } from "../../../modules/sport/api";
import ActivityModalForm from "../../../modules/sport/modals/ActivityModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/sport/list/_list/edit/$activityId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...activityDetailsQuery(params.activityId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { activityId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <ActivityModalForm activityId={activityId} returnTo={returnTo} />;
}
