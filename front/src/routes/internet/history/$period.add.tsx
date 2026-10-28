import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { programsQuery } from "../../../modules/internet/api";
import AddEpisodeModalForm from "../../../modules/internet/modals/AddEpisodeModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/internet/history/$period/add")({
	loader: ({ context }) => context.queryClient.query({ ...programsQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <AddEpisodeModalForm returnTo={returnTo} />;
}
