import { createFileRoute } from "@tanstack/react-router";

import { programDetailsQuery } from "../../../modules/internet/api";
import ProgramDetails from "../../../modules/internet/ProgramDetails";

export const Route = createFileRoute("/internet/$programId/_details")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...programDetailsQuery(params.programId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { programId } = Route.useParams();
	return <ProgramDetails programId={programId} />;
}
