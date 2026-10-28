import { createFileRoute } from "@tanstack/react-router";

import { categoriesQuery } from "../../../modules/money/api";
import CategoryList from "../../../modules/money/categories/CategoryList";

export const Route = createFileRoute("/money/categories/_list")({
	loader: ({ context }) => context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
	component: CategoryList,
});
