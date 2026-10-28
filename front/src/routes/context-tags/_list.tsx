import { createFileRoute } from "@tanstack/react-router";

import { contextTagsQuery } from "../../modules/context-tags/api";
import ContextTagsList from "../../modules/context-tags/List";

export const Route = createFileRoute("/context-tags/_list")({
	loader: ({ context }) => context.queryClient.query({ ...contextTagsQuery(), staleTime: "static" }),
	component: ContextTagsList,
});
