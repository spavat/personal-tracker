import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../hooks/use-sort-table";
import { entityDirectorySort } from "../../modules/entities/api";
import EntityList from "../../modules/entities/pages/EntityList";

export const Route = createFileRoute("/entities/")({
	loader: ({ context }) =>
		context.queryClient.query({ ...storedSortQuery(entityDirectorySort), staleTime: "static" }),
	component: EntityList,
});
