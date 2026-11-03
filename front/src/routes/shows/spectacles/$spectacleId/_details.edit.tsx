import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/ModalStatus";
import { spectacleDetailsQuery } from "../../../../modules/show/api";
import SpectacleModalForm from "../../../../modules/show/modals/SpectacleModalForm";
import { withReturnToSchema } from "../../../../router/search-params";

export const Route = createFileRoute("/shows/spectacles/$spectacleId/_details/edit")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...spectacleDetailsQuery(params.spectacleId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { spectacleId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <SpectacleModalForm spectacleId={spectacleId} returnTo={returnTo} />;
}
