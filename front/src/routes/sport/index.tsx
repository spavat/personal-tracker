import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sport/")({
	beforeLoad: () => {
		throw redirect({ to: "/sport/history" });
	},
});
