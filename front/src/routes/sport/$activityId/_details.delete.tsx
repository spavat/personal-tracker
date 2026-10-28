import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { activityDetailsQuery } from "../../../modules/sport/api";
import DeleteActivityModalForm from "../../../modules/sport/modals/DeleteActivityModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/sport/$activityId/_details/delete")({
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
	return <DeleteActivityModalForm activityId={activityId} returnTo={returnTo} />;
}
