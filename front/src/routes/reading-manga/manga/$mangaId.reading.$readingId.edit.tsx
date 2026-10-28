import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { mangaDetailsQuery } from "../../../modules/reading-manga/api";
import EditReadingModalForm from "../../../modules/reading-manga/modals/EditReadingModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/reading-manga/manga/$mangaId/reading/$readingId/edit")({
	loader: async ({ context, params }) => {
		const manga = await context.queryClient.query({ ...mangaDetailsQuery(params.mangaId), staleTime: "static" });
		if (!manga.readings.some((reading) => reading.id === params.readingId)) {
			throw new Error("Lecture introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { mangaId, readingId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EditReadingModalForm mangaId={mangaId} readingId={readingId} returnTo={returnTo} />;
}
