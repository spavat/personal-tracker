import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/music/stats/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/music/stats/$year", params: { year: currentYear } });
	},
});
