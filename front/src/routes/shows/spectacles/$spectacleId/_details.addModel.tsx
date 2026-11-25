import { createFileRoute } from "@tanstack/react-router";

import { entitiesQuery } from "../../../../components/entity-api";
import { ModalError, ModalPending } from "../../../../components/ModalStatus";
import ModelModalForm from "../../../../modules/show/modals/ModelModalForm";
import { withReturnToSchema } from "../../../../router/search-params";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details/addModel")({
	staticData: { modal: true },
	loader: ({ context }) => context.queryClient.query({ ...entitiesQuery("person"), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { spectacleId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <ModelModalForm spectacleId={spectacleId} returnTo={returnTo} />;
}
