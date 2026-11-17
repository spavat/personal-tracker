import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { authorDetailsQuery } from "../../../modules/reading-book/api";
import AuthorForm from "../../../modules/reading-book/forms/AuthorForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/reading-book/authors/$authorId/edit")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		context.queryClient.query({ ...authorDetailsQuery(params.authorId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { authorId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <AuthorForm authorId={authorId} returnTo={returnTo} />;
}
