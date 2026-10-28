import { createFileRoute } from "@tanstack/react-router";

import { mangaDetailsQuery } from "../../../modules/reading-manga/api";
import MangaDetails from "../../../modules/reading-manga/pages/MangaDetails";

export const Route = createFileRoute("/reading-manga/manga/$mangaId")({
	loader: ({ context, params }) =>
		context.queryClient.query({ ...mangaDetailsQuery(params.mangaId), staleTime: "static" }),
	component: RouteComponent,
});

function RouteComponent() {
	const { mangaId } = Route.useParams();
	return <MangaDetails mangaId={mangaId} />;
}
