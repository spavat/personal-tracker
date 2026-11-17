import { createFileRoute } from "@tanstack/react-router";

import { authorDetailsQuery } from "../../../modules/reading-book/api";
import AuthorDetails from "../../../modules/reading-book/pages/AuthorDetails";

export const Route = createFileRoute("/reading-book/authors/$authorId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...authorDetailsQuery(params.authorId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { authorId } = Route.useParams();
	return <AuthorDetails authorId={authorId} />;
}
