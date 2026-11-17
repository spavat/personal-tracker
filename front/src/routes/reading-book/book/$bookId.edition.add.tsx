import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { bookDetailsQuery } from "../../../modules/reading-book/api";
import EditionForm from "../../../modules/reading-book/forms/EditionForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/reading-book/book/$bookId/edition/add")({
	staticData: { modal: true },
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
	return <EditionForm bookId={bookId} returnTo={returnTo} />;
}
