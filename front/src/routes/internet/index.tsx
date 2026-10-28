import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/internet/")({
	beforeLoad: () => {
		throw redirect({ to: "/internet/history" });
	},
});
