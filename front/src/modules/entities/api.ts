import type { EntityDirectoryItem } from "@personal-tracker/shared/entity";

import { queryOptions } from "@tanstack/react-query";

import type { SortListConfig } from "../../hooks/use-sort-table";

import { fetchJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

// Every entity with its credits counted module by module ("entities": refreshed with the pickers' entities)
async function getDirectory(field: string, direction: string) {
	return fetchJson<EntityDirectoryItem[]>(
		withQuery(`${API_BASE_URL}/entities/directory`, { sort: [field, direction] }),
	);
}
export const entityDirectorySort: SortListConfig<EntityDirectoryItem> = {
	sortOptions: { localKey: "entity_directory", defaultField: "name", defaultDirection: "asc" },
	queryKey: ["entities", "directory"],
	queryFn: getDirectory,
};

export const entityDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["entities", "directory", id],
		queryFn: () => fetchJson<EntityDirectoryItem>(`${API_BASE_URL}/entities/directory/${id}`),
	});

// the entities named like the search, by name (the search modal)
export function searchEntities(search: string) {
	return fetchJson<EntityDirectoryItem[]>(withQuery(`${API_BASE_URL}/entities/directory`, { search }));
}
