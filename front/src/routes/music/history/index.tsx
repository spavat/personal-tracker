import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/music/history/")({
	beforeLoad: () => {
		const yearMonth = Temporal.Now.plainDateISO().toPlainYearMonth().toString();
		throw redirect({ to: "/music/history/$period", params: { period: yearMonth } });
	},
});
