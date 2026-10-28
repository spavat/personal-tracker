import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lifespan/")({
	beforeLoad: () => {
		throw redirect({ to: "/lifespan/timeline" });
	},
});
