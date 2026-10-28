import { createRouter } from "@tanstack/react-router";

import { RouteError, RoutePending } from "./components/route-status";
import { routeTree } from "./routeTree.gen"; // auto-generated

export const router = createRouter({
	routeTree,
	context: { queryClient: undefined! }, // provided by <RouterProvider context>
	defaultPreload: "intent",
	defaultPreloadStaleTime: 0, // let react-query decide what is fresh
	defaultPendingMs: 200,
	defaultPendingComponent: RoutePending,
	defaultErrorComponent: RouteError,
});

// Type registration
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
