import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sport/history/")({
	beforeLoad: () => {
		const yearMonth = Temporal.Now.plainDateISO().toPlainYearMonth().toString();
		throw redirect({ to: "/sport/history/$period", params: { period: yearMonth } });
	},
});
