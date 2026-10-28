import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shows/")({
	beforeLoad: () => {
		throw redirect({ to: "/shows/history" });
	},
});
