import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { tagQuery } from "../../../modules/money/api";
import DeleteTagForm from "../../../modules/money/tags/DeleteTagForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/money/tags/_list/$tagId/delete")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...tagQuery(parseInt(params.tagId, 10)), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { tagId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteTagForm tagId={parseInt(tagId, 10)} returnTo={returnTo} />;
}
