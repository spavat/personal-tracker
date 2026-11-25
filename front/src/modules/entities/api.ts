import { type EntityDirectoryItem, type EntityMergeBody, EntityMergeBodySchema } from "@personal-tracker/shared/entity";
import { queryOptions } from "@tanstack/react-query";

import type { SortListConfig } from "../../hooks/use-sort-table";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
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

// every entity by name, for the merge's pickers (the list's cache when sorted by name)
export const entityNamesQuery = () =>
	queryOptions({
		queryKey: [...entityDirectorySort.queryKey, "name", "asc"],
		queryFn: () => getDirectory("name", "asc"),
	});

// the main entity gets the secondary's credits, the secondary is deleted: answers the main one
export function mergeEntities(body: EntityMergeBody) {
	return sendJson<EntityDirectoryItem>(`${API_BASE_URL}/entities/merge`, "POST", EntityMergeBodySchema.parse(body));
}
