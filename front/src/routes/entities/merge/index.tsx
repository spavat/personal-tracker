import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { entityNamesQuery } from "../../../modules/entities/api";
import Merge from "../../../modules/entities/pages/Merge";

export const Route = createFileRoute("/entities/merge/")({
	// the two entities picked, in the URL
	validateSearch: z.object({ keepId: z.string().optional(), removeId: z.string().optional() }),
	loader: ({ context }) => context.queryClient.query({ ...entityNamesQuery(), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { keepId, removeId } = Route.useSearch();
	return <Merge keepId={keepId} removeId={removeId} />;
}
