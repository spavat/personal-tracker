import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery } from "../../../modules/lifespan/api";
import CategoryModalForm from "../../../modules/lifespan/categories/modals/CategoryModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/lifespan/categories/_list/add")({
	loader: ({ context }) => context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <CategoryModalForm returnTo={returnTo} />;
}
