import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { objectDetailsQuery } from "../../../modules/lifespan/api";
import EventModalForm from "../../../modules/lifespan/objects/modals/EventModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/lifespan/list/_list/$objectId/event/$eventId/edit")({
	loader: async ({ context, params }) => {
		const object = await context.queryClient.query({ ...objectDetailsQuery(params.objectId), staleTime: "static" });
		if (!object.events.some((event) => event.id === params.eventId)) {
			throw new Error("Évènement introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { objectId, eventId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EventModalForm objectId={objectId} eventId={eventId} returnTo={returnTo} />;
}
