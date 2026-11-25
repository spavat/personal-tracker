import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { entityDetailsQuery } from "../../../modules/entities/api";
import EntityModalForm from "../../../modules/entities/modals/EntityModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/entities/$entityId/_details/edit")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		context.queryClient.query({ ...entityDetailsQuery(params.entityId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { entityId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EntityModalForm entityId={entityId} returnTo={returnTo} />;
}
