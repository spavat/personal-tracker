import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery, paymentTypesQuery, tagsQuery } from "../../../modules/money/api";
import NewTransactionForm from "../../../modules/money/NewTransactionForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/transactions/$period/transaction/add")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...paymentTypesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...tagsQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <NewTransactionForm returnTo={returnTo} />;
}
