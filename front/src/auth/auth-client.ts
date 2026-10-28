import { queryOptions } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";

import { API_BASE_URL } from "../config";

// the client needs an absolute URL, API_BASE_URL may be relative ("/api" behind the proxy).
// /auth is part of the URL: the client ignores `basePath` when the URL already has a path
export const authClient = createAuthClient({
	baseURL: new URL(`${API_BASE_URL}/auth`, window.location.origin).href,
});

// null for an anonymous visitor; loaded by the root route before any page renders
export const sessionQuery = () =>
	queryOptions({
		queryKey: ["session"],
		queryFn: async () => (await authClient.getSession()).data ?? null,
		staleTime: Infinity,
	});
