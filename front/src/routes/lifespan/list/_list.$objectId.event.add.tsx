import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { objectDetailsQuery } from "../../../modules/lifespan/api";
import EventModalForm from "../../../modules/lifespan/objects/modals/EventModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/lifespan/list/_list/$objectId/event/add")({
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
	return <EventModalForm objectId={objectId} returnTo={returnTo} />;
}
