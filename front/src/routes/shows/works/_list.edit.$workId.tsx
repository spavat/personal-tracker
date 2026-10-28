import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { workDetailsQuery } from "../../../modules/show/api";
import WorkModalForm from "../../../modules/show/modals/WorkModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/shows/works/_list/edit/$workId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...workDetailsQuery(params.workId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { workId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <WorkModalForm workId={workId} returnTo={returnTo} />;
}
