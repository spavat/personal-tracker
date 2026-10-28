import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { genresQuery } from "../../../modules/music/api";
import DeleteGenreModalForm from "../../../modules/music/genres/modals/DeleteGenreModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/music/genres/_list/delete/$id")({
	loader: async ({ context, params }) => {
		const genres = await context.queryClient.query({ ...genresQuery(), staleTime: "static" });
		if (!genres.some((genre) => genre.id === params.id)) {
			throw new Error("Genre introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteGenreModalForm id={id} returnTo={returnTo} />;
}
