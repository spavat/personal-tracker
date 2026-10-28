import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { categoriesQuery, objectListSort } from "../../../modules/lifespan/api";
import ObjectsList from "../../../modules/lifespan/objects/List";

export const Route = createFileRoute("/lifespan/list/_list")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...storedSortQuery(objectListSort), staleTime: "static" }),
		]),
	component: ObjectsList,
});
