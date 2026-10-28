import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../components/modal-status";
import DeleteAccountForm from "../../../modules/money/accounts/DeleteAccountForm";
import { accountDetailsQuery } from "../../../modules/money/api";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/money/accounts/_tree/account/$accountId/delete")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...accountDetailsQuery(params.accountId), staleTime: "static" }),
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { accountId } = Route.useParams();
	const { returnTo } = Route.useSearch();
	return <DeleteAccountForm accountId={parseInt(accountId, 10)} returnTo={returnTo} />;
}
