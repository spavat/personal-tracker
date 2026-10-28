import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internet/stats/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/internet/stats/$year", params: { year: currentYear } });
	},
});
