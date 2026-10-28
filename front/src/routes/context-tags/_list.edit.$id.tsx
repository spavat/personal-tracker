import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../components/modal-status";
import { contextTagsQuery } from "../../modules/context-tags/api";
import ContextTagModalForm from "../../modules/context-tags/modals/ContextTagModalForm";
import { withReturnToSchema } from "../../router/searchParams";

export const Route = createFileRoute("/context-tags/_list/edit/$id")({
	loader: async ({ context, params }) => {
		const contextTags = await context.queryClient.query({ ...contextTagsQuery(), staleTime: "static" });
		if (!contextTags.some((contextTag) => contextTag.id === params.id)) {
			throw new Error("Tag principal introuvable");
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
	return <ContextTagModalForm id={id} returnTo={returnTo} />;
}
