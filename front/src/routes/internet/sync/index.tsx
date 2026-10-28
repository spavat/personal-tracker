import { createFileRoute } from "@tanstack/react-router";

import { programsQuery, syncQuery } from "../../../modules/internet/api";
import Sync from "../../../modules/internet/Sync";

export const Route = createFileRoute("/internet/sync/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query({ ...syncQuery(), staleTime: "static" }),
			context.queryClient.query({ ...programsQuery(), staleTime: "static" }),
		]),
	component: RouteComponent,
});

function RouteComponent() {
	return <Sync />;
}
