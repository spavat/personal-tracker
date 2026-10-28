import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import NewAccountForm from "../../../modules/money/accounts/NewAccountForm";
import { banksQuery } from "../../../modules/money/api";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/accounts/_tree/account/add")({
	loader: ({ context }) => context.queryClient.query({ ...banksQuery(), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <NewAccountForm returnTo={returnTo} />;
}
