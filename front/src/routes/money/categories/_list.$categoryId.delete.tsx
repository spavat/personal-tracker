import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoryQuery } from "../../../modules/money/api";
import DeleteCategoryForm from "../../../modules/money/categories/DeleteCategoryForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/categories/_list/$categoryId/delete")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...categoryQuery(parseInt(params.categoryId, 10)), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { categoryId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteCategoryForm categoryId={parseInt(categoryId, 10)} returnTo={returnTo} />;
}
