import { createFileRoute } from "@tanstack/react-router";

import { readStoredValue } from "../../../hooks/stored-value";
import {
	categoriesQuery,
	monthRange,
	paymentTypesQuery,
	transactionsQuery,
	USE_TRANSACTION_DATE_STORAGE,
} from "../../../modules/money/api";
import MoneyTransactions from "../../../modules/money/transactions/Transactions";

export const Route = createFileRoute("/money/transactions/$period")({
	loader: ({ context, params }) => {
		const { from, to } = monthRange(params.period);
		const useTransactionDate = readStoredValue(
			USE_TRANSACTION_DATE_STORAGE.key,
			USE_TRANSACTION_DATE_STORAGE.defaultValue,
		);
		return Promise.all([
			context.queryClient.query({
				...transactionsQuery(from, to, undefined, useTransactionDate),
				staleTime: "static",
			}),
			context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...paymentTypesQuery(), staleTime: "static" }),
		]);
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { period } = Route.useParams();
	return <MoneyTransactions period={period} />;
}
