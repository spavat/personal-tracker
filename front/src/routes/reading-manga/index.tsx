import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reading-manga/")({
	beforeLoad: () => {
		throw redirect({ to: "/reading-manga/history" });
	},
});
