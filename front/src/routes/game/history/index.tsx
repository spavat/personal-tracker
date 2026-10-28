import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/game/history/")({
	beforeLoad: () => {
		const currentYear = String(Temporal.Now.plainDateISO().year);
		throw redirect({ to: "/game/history/$year", params: { year: currentYear } });
	},
});
