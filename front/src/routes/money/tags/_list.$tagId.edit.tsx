import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { tagQuery, tagsQuery } from "../../../modules/money/api";
import NewTagForm from "../../../modules/money/tags/NewTagForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/tags/_list/$tagId/edit")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...tagQuery(parseInt(params.tagId, 10)), staleTime: "static" }),
			context.queryClient.query({ ...tagsQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { tagId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <NewTagForm tagId={parseInt(tagId, 10)} returnTo={returnTo} />;
}
