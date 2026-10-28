import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { programDetailsQuery, programsQuery } from "../../../modules/internet/api";
import AddEpisodeModalForm from "../../../modules/internet/modals/AddEpisodeModalForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/internet/$programId/_details/add")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...programsQuery(), staleTime: "static" }),
			context.queryClient.query({ ...programDetailsQuery(params.programId), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { programId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <AddEpisodeModalForm programId={programId} returnTo={returnTo} />;
}
