import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/broadcast/stats/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/broadcast/stats/$year", params: { year: currentYear } });
	},
});
