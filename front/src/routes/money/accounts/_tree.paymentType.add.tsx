import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/ModalStatus";
import NewPaymentTypeForm from "../../../modules/money/accounts/NewPaymentTypeForm";
import { banksTreeQuery } from "../../../modules/money/api";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/money/accounts/_tree/paymentType/add")({
	staticData: { modal: true },
	loader: ({ context }) => context.queryClient.query({ ...banksTreeQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <NewPaymentTypeForm returnTo={returnTo} />;
}
