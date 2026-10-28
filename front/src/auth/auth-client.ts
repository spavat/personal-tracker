import { queryOptions } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";

import { API_BASE_URL } from "../config";

export const authClient = createAuthClient({ baseURL: API_BASE_URL, basePath: "/auth" });

// null for an anonymous visitor; loaded by the root route before any page renders
export const sessionQuery = () =>
	queryOptions({
		queryKey: ["session"],
		queryFn: async () => (await authClient.getSession()).data ?? null,
		staleTime: Infinity,
	});
