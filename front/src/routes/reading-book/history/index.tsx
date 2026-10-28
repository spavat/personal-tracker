import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reading-book/history/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/reading-book/history/$year", params: { year: currentYear } });
	},
});
