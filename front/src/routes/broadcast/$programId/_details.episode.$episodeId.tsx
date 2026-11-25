import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { programDetailsQuery } from "../../../modules/broadcast/api";
import EpisodeDetailsModal from "../../../modules/broadcast/modals/EpisodeDetailsModal";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/broadcast/$programId/_details/episode/$episodeId")({
	staticData: { modal: true },
	loader: async ({ context, params }) => {
		const program = await context.queryClient.query({
			...programDetailsQuery(params.programId),
			staleTime: "static",
		});
		if (!program.episodes.some(({ id }) => id === params.episodeId)) {
			throw new Error("Épisode introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { programId, episodeId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EpisodeDetailsModal programId={programId} episodeId={episodeId} returnTo={returnTo} />;
}
