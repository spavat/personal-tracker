import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internet/history/")({
	beforeLoad: () => {
		const yearMonth = Temporal.Now.plainDateISO().toPlainYearMonth().toString();
		throw redirect({ to: "/internet/history/$period", params: { period: yearMonth } });
	},
});
