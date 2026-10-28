import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { placeDetailsQuery } from "../../../modules/show/api";
import PlaceModalForm from "../../../modules/show/modals/PlaceModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/shows/places/_list/edit/$placeId")({
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
	return <PlaceModalForm placeId={placeId} returnTo={returnTo} />;
}
