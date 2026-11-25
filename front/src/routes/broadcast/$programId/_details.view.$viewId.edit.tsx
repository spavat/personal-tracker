import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { programDetailsQuery } from "../../../modules/broadcast/api";
import EditEpisodeModalForm from "../../../modules/broadcast/modals/EditEpisodeModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/broadcast/$programId/_details/view/$viewId/edit")({
	staticData: { modal: true },
	loader: async ({ context, params }) => {
		const program = await context.queryClient.query({
			...programDetailsQuery(params.programId),
			staleTime: "static",
		});
		if (!program.episodes.some(({ views }) => views.some((view) => view.id === params.viewId))) {
			throw new Error("Épisode introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { programId, viewId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EditEpisodeModalForm programId={programId} viewId={viewId} returnTo={returnTo} />;
}
