import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import DeleteBankForm from "../../../modules/money/accounts/DeleteBankForm";
import { bankQuery } from "../../../modules/money/api";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/accounts/_tree/bank/$bankId/delete")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...bankQuery(parseInt(params.bankId, 10)), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { bankId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteBankForm bankId={parseInt(bankId, 10)} returnTo={returnTo} />;
}
