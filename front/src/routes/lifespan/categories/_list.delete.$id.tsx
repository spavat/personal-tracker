import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery } from "../../../modules/lifespan/api";
import DeleteCategoryModalForm from "../../../modules/lifespan/categories/modals/DeleteCategoryModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/lifespan/categories/_list/delete/$id")({
	loader: async ({ context, params }) => {
		const categories = await context.queryClient.query({ ...categoriesQuery(), staleTime: "static" });
		if (!categories.some((category) => category.id === params.id)) {
			throw new Error("Catégorie introuvable");
		}
	},
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { id } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteCategoryModalForm id={id} returnTo={returnTo} />;
}
