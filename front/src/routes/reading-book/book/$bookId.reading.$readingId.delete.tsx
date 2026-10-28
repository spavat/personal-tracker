import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { bookDetailsQuery } from "../../../modules/reading-book/api";
import DeleteReadingModalForm from "../../../modules/reading-book/modals/DeleteReadingModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/reading-book/book/$bookId/reading/$readingId/delete")({
	loader: async ({ context, params }) => {
		const book = await context.queryClient.query({ ...bookDetailsQuery(params.bookId), staleTime: "static" });
		if (!book.readings.some((reading) => reading.id === params.readingId)) {
			throw new Error("Lecture introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { bookId, readingId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteReadingModalForm bookId={bookId} readingId={readingId} returnTo={returnTo} />;
}
