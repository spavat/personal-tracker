import { createFileRoute } from "@tanstack/react-router";

import { storedSortQuery } from "../../../hooks/use-sort-table";
import { programListSort } from "../../../modules/broadcast/api";
import ProgramList from "../../../modules/broadcast/pages/ProgramList";

export const Route = createFileRoute("/broadcast/list/_list")({
	loader: ({ context }) => context.queryClient.query({ ...storedSortQuery(programListSort), staleTime: "static" }),
	component: ProgramList,
});
