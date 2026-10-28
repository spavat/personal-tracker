import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import NewAccountForm from "../../../modules/money/accounts/NewAccountForm";
import { accountQuery, banksQuery } from "../../../modules/money/api";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/accounts/_tree/account/$accountId/edit")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...accountQuery(parseInt(params.accountId, 10)), staleTime: "static" }),
			context.queryClient.query({ ...banksQuery(), staleTime: "static" }),
		]),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { accountId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <NewAccountForm accountId={parseInt(accountId, 10)} returnTo={returnTo} />;
}
