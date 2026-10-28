import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { groupDetailsQuery, groupTransactionsQuery } from "../../../modules/money/api";
import MoneyGroupTransactions from "../../../modules/money/transactions/TransactionsGroup";

const paramsSchema = z.object({
	type: z.enum(["category", "tag", "account"]),
	id: z.string(),
});

export const Route = createFileRoute("/money/transactions/$type/$id")({
	loader: ({ context, params }) =>
		Promise.all([
			context.queryClient.query({ ...groupTransactionsQuery(params.type, params.id), staleTime: "static" }),
			context.queryClient.query({ ...groupDetailsQuery(params.type, params.id), staleTime: "static" }),
		]),
	params: {
		parse: paramsSchema.parse,
		stringify: (p) => p,
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { type, id } = Route.useParams();
	return <MoneyGroupTransactions type={type} id={id} />;
}
