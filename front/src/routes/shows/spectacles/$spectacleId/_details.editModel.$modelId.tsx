import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/modal-status";
import { artistsQuery, modelDetailsQuery } from "../../../../modules/show/api";
import ModelModalForm from "../../../../modules/show/modals/ModelModalForm";
import { withReturnToSchema } from "../../../../router/searchParams";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details/editModel/$modelId")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...modelDetailsQuery(params.modelId), staleTime: "static" }),
			context.queryClient.query({ ...artistsQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { modelId, spectacleId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <ModelModalForm modelId={modelId} spectacleId={spectacleId} returnTo={returnTo} />;
}
