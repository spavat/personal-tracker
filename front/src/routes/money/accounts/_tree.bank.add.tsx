import { createFileRoute } from "@tanstack/react-router";

import NewBankForm from "../../../modules/money/accounts/NewBankForm";
import { withReturnToSchema } from "../../../router/search-params";

export const Route = createFileRoute("/money/accounts/_tree/bank/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <NewBankForm returnTo={returnTo} />;
}
