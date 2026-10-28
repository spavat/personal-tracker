import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/modal-status";
import { modelDetailsQuery } from "../../../../modules/show/api";
import DeleteModelModalForm from "../../../../modules/show/modals/DeleteModelModalForm";
import { withReturnToSchema } from "../../../../router/searchParams";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details/deleteModel/$modelId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...modelDetailsQuery(params.modelId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { modelId, spectacleId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteModelModalForm modelId={modelId} spectacleId={spectacleId} returnTo={returnTo} />;
}
