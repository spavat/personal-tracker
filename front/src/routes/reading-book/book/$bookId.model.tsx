import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { bookDetailsQuery } from "../../../modules/reading-book/api";
import ModelForm from "../../../modules/reading-book/forms/ModelForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/reading-book/book/$bookId/model")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...bookDetailsQuery(params.bookId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { bookId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <ModelForm bookId={bookId} returnTo={returnTo} />;
}
