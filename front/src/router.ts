import { createRouter, type ParsedLocation } from "@tanstack/react-router";

import { RouteError, RoutePending } from "./components/RouteStatus";
import { routeTree } from "./routeTree.gen"; // auto-generated

// route flagged with `staticData: { modal: true }`: a window opened over the current page
function isModal(location: ParsedLocation | undefined): boolean {
	if (!location) return false;
	const [matchedRoutes] = router.getMatchedRoutes(location.pathname);
	return matchedRoutes.some((route) => route.options.staticData?.modal);
}

export const router = createRouter({
	routeTree,
	// navigations without their own `viewTransition` (back/forward buttons, menu…): animate page changes,
	// but not a search-only change, nor opening/closing a modal (the pictures being animated, like a
	// portrait, would be drawn over the modal for the length of the transition)
	defaultViewTransition: {
		types: ({ fromLocation, toLocation, pathChanged }) =>
			pathChanged && !isModal(fromLocation) && !isModal(toLocation) ? [] : false,
	},
	// back/forward restore the scroll, so the card the portrait transitions to is rendered
	scrollRestoration: true,
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
	interface StaticDataRouteOption {
		modal?: boolean;
	}
}
