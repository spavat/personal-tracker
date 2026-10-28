import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shows/history/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/shows/history/$year", params: { year: currentYear } });
	},
});
