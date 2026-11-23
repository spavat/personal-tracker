import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { programsQuery } from "../../../modules/broadcast/api";
import AddEpisodeModalForm from "../../../modules/broadcast/modals/AddEpisodeModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/broadcast/history/$period/add")({
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
