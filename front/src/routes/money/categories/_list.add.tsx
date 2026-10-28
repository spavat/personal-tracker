import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery } from "../../../modules/money/api";
import NewCategoryForm from "../../../modules/money/categories/NewCategorieForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/categories/_list/add")({
	loader: ({ context }) => context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <NewCategoryForm returnTo={returnTo} />;
}
