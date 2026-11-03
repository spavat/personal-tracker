import { createFileRoute } from "@tanstack/react-router";

import { genresQuery } from "../../../modules/music/api";
import GenreList from "../../../modules/music/pages/GenreList";

export const Route = createFileRoute("/music/genres/_list")({
	loader: ({ context }) => context.queryClient.query({ ...genresQuery(), staleTime: "static" }),
	component: GenreList,
});
