import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { bookDetailsQuery } from "../../../modules/reading-book/api";
import EditionForm from "../../../modules/reading-book/forms/EditionForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/reading-book/book/$bookId/edition/$editionId/edit")({
	staticData: { modal: true },
	loader: async ({ context, params }) => {
		const book = await context.queryClient.query({ ...bookDetailsQuery(params.bookId), staleTime: "static" });
		if (!book.editions.some((edition) => edition.id === params.editionId)) {
			throw new Error("Édition introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { bookId, editionId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <EditionForm bookId={bookId} editionId={editionId} returnTo={returnTo} />;
}
