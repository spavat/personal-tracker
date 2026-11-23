import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import { programDetailsQuery } from "../../../modules/broadcast/api";
import ProgramModalForm from "../../../modules/broadcast/modals/ProgramModalForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/broadcast/$programId/_details/edit")({
	staticData: { modal: true },
	loader: ({ context, params }) =>
		context.queryClient.query({ ...programDetailsQuery(params.programId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { programId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <ProgramModalForm programId={programId} returnTo={returnTo} />;
}
