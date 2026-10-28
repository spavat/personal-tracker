import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { programDetailsQuery } from "../../../modules/internet/api";
import DeleteEpisodeModalForm from "../../../modules/internet/modals/DeleteEpisodeModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/internet/$programId/_details/episode/$episodeId/delete")({
	loader: async ({ context, params }) => {
		const program = await context.queryClient.query({
			...programDetailsQuery(params.programId),
			staleTime: "static",
		});
		if (!program.episodes.some((episode) => episode.id === params.episodeId)) {
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
	return <DeleteEpisodeModalForm programId={programId} episodeId={episodeId} returnTo={returnTo} />;
}
