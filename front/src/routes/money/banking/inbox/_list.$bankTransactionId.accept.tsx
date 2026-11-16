import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/ModalStatus";
import { bankInboxQuery, categoriesQuery, paymentTypesQuery, tagsQuery } from "../../../../modules/money/api";
import AcceptBankTransactionForm from "../../../../modules/money/banking/AcceptBankTransactionForm";
import { withReturnToSchema } from "../../../../router/search-params";

export const Route = createFileRoute("/money/banking/inbox/_list/$bankTransactionId/accept")({
	staticData: { modal: true },
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(bankInboxQuery()),
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
	const { bankTransactionId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <AcceptBankTransactionForm id={Number(bankTransactionId)} returnTo={returnTo} />;
}
