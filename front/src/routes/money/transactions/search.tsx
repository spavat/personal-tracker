import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import MoneyTransactions from "../../../modules/money/transactions/Transactions";

export const Route = createFileRoute("/money/transactions/search")({
	validateSearch: z
		.object({
			search: z.string().optional(),
			from: z.string().optional(),
			to: z.string().optional(),
		})
		.optional(),
	component: RouteComponent,
});

function RouteComponent() {
	const { search, from, to } = Route.useSearch() ?? { search: "", from: "", to: "" };
	return <MoneyTransactions search={search} from={from} to={to} />;
}
