import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { ModalError, ModalPending } from "../../../components/modal-status";
import { categoriesQuery, paymentTypesQuery, tagsQuery, transactionQuery } from "../../../modules/money/api";
import NewTransactionForm from "../../../modules/money/NewTransactionForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/transactions/search/transaction/$transactionId/edit")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...transactionQuery(parseInt(params.transactionId, 10)), staleTime: "static" }),
			context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...paymentTypesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...tagsQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema.extend({
		returnToSearch: z
			.object({
				search: z.string().optional(),
				from: z.string().optional(),
				to: z.string().optional(),
			})
			.optional(),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo, returnToSearch } = Route.useSearch();
	const { transactionId } = Route.useParams();
	return (
		<NewTransactionForm
			transactionId={parseInt(transactionId, 10)}
			returnTo={returnTo}
			returnToSearch={returnToSearch}
		/>
	);
}
