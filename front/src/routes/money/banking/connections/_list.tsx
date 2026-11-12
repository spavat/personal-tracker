import { createFileRoute } from "@tanstack/react-router";

import { bankConnectionsQuery, banksTreeQuery } from "../../../../modules/money/api";
import BankConnections from "../../../../modules/money/banking/BankConnections";

export const Route = createFileRoute("/money/banking/connections/_list")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query(bankConnectionsQuery()),
			context.queryClient.query({ ...banksTreeQuery(), staleTime: "static" }),
		]),
	component: BankConnections,
});
