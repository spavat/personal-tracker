import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/modal-status";
import { artistsQuery } from "../../../../modules/show/api";
import ModelModalForm from "../../../../modules/show/modals/ModelModalForm";
import { withReturnToSchema } from "../../../../router/searchParams";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details/addModel")({
	loader: ({ context }) => context.queryClient.query({ ...artistsQuery(), staleTime: "static" }),
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
