import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reading-book/")({
	beforeLoad: () => {
		throw redirect({ to: "/reading-book/history" });
	},
});
