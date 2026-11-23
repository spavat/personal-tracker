import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/broadcast/history/")({
	beforeLoad: () => {
		const yearMonth = Temporal.Now.plainDateISO().toPlainYearMonth().toString();
		throw redirect({ to: "/broadcast/history/$period", params: { period: yearMonth } });
	},
});
