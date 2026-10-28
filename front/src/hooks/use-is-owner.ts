import { useQuery } from "@tanstack/react-query";

import { sessionQuery } from "../auth/auth-client";

export function useIsOwner() {
	return useQuery(sessionQuery()).data != null;
}
