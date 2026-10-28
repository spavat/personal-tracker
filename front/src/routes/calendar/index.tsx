import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/calendar/")({
	beforeLoad: () => {
		const yearMonth = Temporal.Now.plainDateISO().toPlainYearMonth().toString();
		throw redirect({ to: "/calendar/$period", params: { period: yearMonth } });
	},
});
