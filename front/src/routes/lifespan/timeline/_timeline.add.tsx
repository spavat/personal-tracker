import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery } from "../../../modules/lifespan/api";
import ObjectModalForm from "../../../modules/lifespan/objects/modals/ObjectModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/lifespan/timeline/_timeline/add")({
	loader: ({ context }) => context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <ObjectModalForm returnTo={returnTo} />;
}
