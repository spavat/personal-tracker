import { GetLatestResponse } from "@personal-tracker/shared/home";
import { queryOptions } from "@tanstack/react-query";

import { fetchJson } from "../../api-utils";
import { API_BASE_URL } from "../../config";

export const latestQuery = queryOptions({
	queryKey: ["home", "latest"],
	queryFn: () => fetchJson<GetLatestResponse>(`${API_BASE_URL}/home/latest`),
});
