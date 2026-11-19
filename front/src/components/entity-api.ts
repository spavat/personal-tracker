import type { Entity, EntityKind, SaveEntityBody } from "@personal-tracker/shared/entity";

import { queryOptions } from "@tanstack/react-query";

import { fetchJson, saveJson, withQuery } from "../api-utils";
import { API_BASE_URL } from "../config";

// People, groups and organizations shared by every module (core entities)
export const entitiesQuery = (kind: EntityKind) =>
	queryOptions({
		queryKey: ["entities", kind],
		queryFn: () => fetchJson<Entity[]>(withQuery(`${API_BASE_URL}/entities`, { kind })),
	});

// `picture`: the URL given by the server or left out = unchanged, an image URL or a data URI = new, null = none
export function saveEntity(entity: SaveEntityBody, id?: string) {
	return saveJson<Entity>(`${API_BASE_URL}/entities`, id, entity);
}
