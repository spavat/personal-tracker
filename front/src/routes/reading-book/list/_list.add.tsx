import { createFileRoute } from "@tanstack/react-router";

import BookForm from "../../../modules/reading-book/forms/BookForm";
import { withReturnToSchema } from "../../../router/searchParams";

export const Route = createFileRoute("/reading-book/list/_list/add")({
	validateSearch: withReturnToSchema,
	component: RouteComponent,
});

function RouteComponent() {
	const { returnTo } = Route.useSearch();
	return <BookForm returnTo={returnTo} />;
}
