import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import DeletePaymentTypeForm from "../../../modules/money/accounts/DeletePaymentTypeForm";
import { paymentTypeDetailsQuery } from "../../../modules/money/api";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/accounts/_tree/paymentType/$paymentTypeId/delete")({
	loader: ({ context, params }) =>
		context.queryClient.query({
			...paymentTypeDetailsQuery(parseInt(params.paymentTypeId, 10)),
			staleTime: "static",
		}),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { paymentTypeId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeletePaymentTypeForm paymentTypeId={parseInt(paymentTypeId, 10)} returnTo={returnTo} />;
}
