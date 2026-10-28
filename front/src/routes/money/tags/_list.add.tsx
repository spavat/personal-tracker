import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { tagsQuery } from "../../../modules/money/api";
import NewTagForm from "../../../modules/money/tags/NewTagForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/tags/_list/add")({
	loader: ({ context }) => context.queryClient.query({ ...tagsQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <NewTagForm returnTo={returnTo} />;
}
