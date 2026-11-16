import { createFileRoute } from "@tanstack/react-router";

import { ModalError, ModalPending } from "../../../../components/ModalStatus";
import AddBankConnectionForm from "../../../../modules/money/banking/AddBankConnectionForm";
import { withReturnToSchema } from "../../../../router/search-params";

export const Route = createFileRoute("/money/banking/connections/_list/add")({
	staticData: { modal: true },
	pendingComponent: ModalPending,
	errorComponent: ModalError,
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <AddBankConnectionForm returnTo={returnTo} />;
}
