import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery } from "../../../modules/lifespan/api";
import CategoryModalForm from "../../../modules/lifespan/categories/modals/CategoryModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/lifespan/categories/_list/edit/$id")({
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
	return <CategoryModalForm id={id} returnTo={returnTo} />;
}
