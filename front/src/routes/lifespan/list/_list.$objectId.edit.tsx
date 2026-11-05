import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { categoriesQuery, objectDetailsQuery } from "../../../modules/lifespan/api";
import ObjectModalForm from "../../../modules/lifespan/objects/modals/ObjectModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/lifespan/list/_list/$objectId/edit")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...objectDetailsQuery(params.objectId), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { objectId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <ObjectModalForm id={objectId} returnTo={returnTo} />;
}
