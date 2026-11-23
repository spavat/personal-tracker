import { createFileRoute } from "@tanstack/react-router";

import { gopodderStatusQuery, programsQuery, syncQuery, unknownFeedsQuery } from "../../../modules/broadcast/api";
import Sync from "../../../modules/broadcast/pages/Sync";

export const Route = createFileRoute("/broadcast/sync/")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query({ ...syncQuery(), staleTime: "static" }),
			context.queryClient.query({ ...unknownFeedsQuery(), staleTime: "static" }),
			context.queryClient.query({ ...gopodderStatusQuery(), staleTime: "static" }),
			context.queryClient.query({ ...programsQuery(), staleTime: "static" }),
		]),
	component: RouteComponent,
});

function RouteComponent() {
	return <Sync />;
}
