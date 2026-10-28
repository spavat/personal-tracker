import { createFileRoute } from "@tanstack/react-router";

import { tagsQuery } from "../../../modules/money/api";
import TagsList from "../../../modules/money/tags/TagList";

export const Route = createFileRoute("/money/tags/_list")({
	loader: ({ context }) => context.queryClient.query({ ...tagsQuery(), staleTime: "static" }),
	component: TagsList,
});
