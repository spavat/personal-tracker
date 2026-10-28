import { createFileRoute } from "@tanstack/react-router";

import { genresQuery } from "../../../modules/music/api";
import GenresList from "../../../modules/music/genres/List";

export const Route = createFileRoute("/music/genres/_list")({
	loader: ({ context }) => context.queryClient.query({ ...genresQuery(), staleTime: "static" }),
	component: GenresList,
});
