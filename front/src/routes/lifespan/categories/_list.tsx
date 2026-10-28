import { createFileRoute } from "@tanstack/react-router";

import { categoriesQuery } from "../../../modules/lifespan/api";
import CategoriesList from "../../../modules/lifespan/categories/List";

export const Route = createFileRoute("/lifespan/categories/_list")({
	loader: ({ context }) => context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
	component: CategoriesList,
});
