import { createFileRoute } from "@tanstack/react-router";

import { bookDetailsQuery } from "../../../modules/reading-book/api";
import BookDetails from "../../../modules/reading-book/BookDetails";

export const Route = createFileRoute("/reading-book/book/$bookId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...bookDetailsQuery(params.bookId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { bookId } = Route.useParams();
	return <BookDetails bookId={bookId} />;
}
