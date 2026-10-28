import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, redirect } from "@tanstack/react-router";

import App from "../App";
import { sessionQuery } from "../auth/auth-client";
import { isPublicPath } from "../auth/public-paths";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
	beforeLoad: async ({ context, location }) => {
		const session = await context.queryClient.query(sessionQuery());
		if (!session && !isPublicPath(location.pathname)) {
			throw redirect({ to: "/" });
		}
	},
	component: () => (
		<>
			<App />
		</>
	),
});
