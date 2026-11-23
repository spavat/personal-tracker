import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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
	// isbn: the edition to look up on Open Library when the form opens (a book just created from that ISBN)
	// (a URL typed by hand reads digits as a number)
	validateSearch: withReturnToSchema.extend({ isbn: z.union([z.string(), z.number().transform(String)]).optional() }),
	component: RouteComponent,
});

function RouteComponent() {
	const { bookId, editionId } = Route.useParams();
	const { returnTo, isbn } = Route.useSearch();
	return <EditionForm bookId={bookId} editionId={editionId} returnTo={returnTo} isbn={isbn} />;
}
