import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { bookDetailsQuery } from "../../../modules/reading-book/api";
import DeleteModelModalForm from "../../../modules/reading-book/modals/DeleteModelModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/reading-book/book/$bookId/model/$modelId/delete")({
	staticData: { modal: true },
	loader: async ({ context, params }) => {
		const book = await context.queryClient.query({ ...bookDetailsQuery(params.bookId), staleTime: "static" });
		if (!book.models.some((model) => model.id === params.modelId)) {
			throw new Error("Modèle introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { bookId, modelId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteModelModalForm bookId={bookId} modelId={modelId} returnTo={returnTo} />;
}
