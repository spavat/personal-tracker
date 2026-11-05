import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { programsQuery } from "../../../modules/internet/api";
import AddEpisodeModalForm from "../../../modules/internet/modals/AddEpisodeModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/internet/history/$period/add")({
	staticData: { modal: true },
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
