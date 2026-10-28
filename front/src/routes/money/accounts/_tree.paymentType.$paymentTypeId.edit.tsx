import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import NewPaymentTypeForm from "../../../modules/money/accounts/NewPaymentTypeForm";
import { banksTreeQuery, paymentTypeQuery } from "../../../modules/money/api";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/accounts/_tree/paymentType/$paymentTypeId/edit")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...paymentTypeQuery(parseInt(params.paymentTypeId, 10)), staleTime: "static" }),
			context.queryClient.query({ ...banksTreeQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { paymentTypeId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <NewPaymentTypeForm paymentTypeId={parseInt(paymentTypeId, 10)} returnTo={returnTo} />;
}
