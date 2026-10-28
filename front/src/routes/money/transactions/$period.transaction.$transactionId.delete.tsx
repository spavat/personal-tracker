import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { transactionQuery } from "../../../modules/money/api";
import DeleteTransactionForm from "../../../modules/money/transactions/DeleteTransactionForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/transactions/$period/transaction/$transactionId/delete")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...transactionQuery(parseInt(params.transactionId, 10)), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	const { transactionId } = Route.useParams();
	return <DeleteTransactionForm transactionId={parseInt(transactionId, 10)} returnTo={returnTo} />;
}
