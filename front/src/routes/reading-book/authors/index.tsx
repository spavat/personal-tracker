import { createFileRoute } from "@tanstack/react-router";

import { authorsQuery } from "../../../modules/reading-book/api";
import AuthorList from "../../../modules/reading-book/pages/AuthorList";

export const Route = createFileRoute("/reading-book/authors/")({
	loader: ({ context }) => context.queryClient.query({ ...authorsQuery(), staleTime: "static" }),
	component: AuthorList,
});
