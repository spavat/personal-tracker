import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { placeDetailsQuery } from "../../../modules/show/api";
import DeletePlaceModalForm from "../../../modules/show/modals/DeletePlaceModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/shows/places/_list/delete/$placeId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...placeDetailsQuery(params.placeId, false), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { placeId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeletePlaceModalForm placeId={placeId} returnTo={returnTo} />;
}
