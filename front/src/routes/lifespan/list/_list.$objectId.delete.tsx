import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { objectDetailsQuery } from "../../../modules/lifespan/api";
import DeleteObjectModalForm from "../../../modules/lifespan/objects/modals/DeleteObjectModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/lifespan/list/_list/$objectId/delete")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...objectDetailsQuery(params.objectId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { objectId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteObjectModalForm id={objectId} returnTo={returnTo} />;
}
