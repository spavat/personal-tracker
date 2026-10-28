import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/money/transactions/")({
	beforeLoad: () => {
		const yearMonth = Temporal.Now.plainDateISO().toPlainYearMonth().toString();
		throw redirect({ to: "/money/transactions/$period", params: { period: yearMonth } });
	},
});
