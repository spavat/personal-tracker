import { createFileRoute, Outlet } from "@tanstack/react-router";
import z from "zod";

import { allObjectsQuery, categoriesQuery } from "../../../modules/lifespan/api";
import Timeline from "../../../modules/lifespan/timeline/Timeline";

export const Route = createFileRoute("/lifespan/timeline/_timeline")({
	loader: ({ context }) =>
		Promise.all([
			context.queryClient.query({ ...categoriesQuery(), staleTime: "static" }),
			context.queryClient.query({ ...allObjectsQuery(), staleTime: "static" }),
		]),
	// invalid values (e.g. from a hand-edited shared link) are ignored instead of failing the page
	validateSearch: z.object({
		from: z.iso.date().optional().catch(undefined),
		to: z.iso.date().optional().catch(undefined),
		categoryId: z.uuid().optional().catch(undefined),
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { from, to, categoryId } = Route.useSearch();
	return (
		<>
			{/* remount on filter change (back/forward, reset) so the draft inputs follow the url */}
			<Timeline key={`${from}|${to}|${categoryId}`} from={from} to={to} categoryId={categoryId} />
			<Outlet />
		</>
	);
}
