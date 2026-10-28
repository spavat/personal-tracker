import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery, categoryQuery } from "../../../modules/money/api";
import NewCategoryForm from "../../../modules/money/categories/NewCategorieForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/categories/_list/$categoryId/edit")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...categoryQuery(parseInt(params.categoryId, 10)), staleTime: "static" }),
			context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { categoryId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <NewCategoryForm categoryId={parseInt(categoryId, 10)} returnTo={returnTo} />;
}
