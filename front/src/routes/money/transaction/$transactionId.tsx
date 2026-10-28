import { createFileRoute } from "@tanstack/react-router";

import { transactionQuery } from "../../../modules/money/api";
import TransactionDetails from "../../../modules/money/transactions/TransactionDetails";

export const Route = createFileRoute("/money/transaction/$transactionId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...transactionQuery(Number(params.transactionId)), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { transactionId } = Route.useParams();
	return <TransactionDetails transactionId={Number(transactionId)} />;
}
