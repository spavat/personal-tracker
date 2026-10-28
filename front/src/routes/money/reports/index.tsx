import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/money/reports/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/money/reports/$year", params: { year: currentYear } });
	},
});
