import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/broadcast/")({
	beforeLoad: () => {
		throw redirect({ to: "/broadcast/history" });
	},
});
