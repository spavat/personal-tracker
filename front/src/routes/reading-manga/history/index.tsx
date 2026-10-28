import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reading-manga/history/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/reading-manga/history/$year", params: { year: currentYear } });
	},
});
