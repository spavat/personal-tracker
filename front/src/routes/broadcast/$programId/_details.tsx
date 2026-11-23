import { createFileRoute } from "@tanstack/react-router";

import { programDetailsQuery } from "../../../modules/broadcast/api";
import ProgramDetails from "../../../modules/broadcast/pages/ProgramDetails";

export const Route = createFileRoute("/broadcast/$programId/_details")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...programDetailsQuery(params.programId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { programId } = Route.useParams();
	return <ProgramDetails programId={programId} />;
}
