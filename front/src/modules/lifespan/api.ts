import {
	LifespanCategory,
	LifespanCategoryDeleteParamsRequestSchema,
	LifespanCategoryListResponseSchema,
	LifespanCategorySaveBodyRequestSchema,
	LifespanEventDeleteParamsRequestSchema,
	LifespanObjectDeleteParamsRequestSchema,
	LifespanObjectSaveBodyRequestSchema,
	LifespanObjectWithStatus,
} from "@personal-tracker/shared/lifespan";
import { queryOptions } from "@tanstack/react-query";

import type { SortListConfig } from "../../hooks/use-sort-table";

import { checkResponse, fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

//
// CATEGORIES
//
async function getCategories(): Promise<Array<LifespanCategory>> {
	const data = await fetchJson(`${API_BASE_URL}/lifespan/categories/list`);
	const parsedResponse = LifespanCategoryListResponseSchema.safeParse(data);
	if (!parsedResponse.success) {
		console.error(parsedResponse.error);
		return [];
	}
	return parsedResponse.data;
}
export const categoriesQuery = () =>
	queryOptions({
		queryKey: ["lifespan", "categories"],
		queryFn: () => getCategories(),
	});

export async function saveCategory(data: any) {
	const sentData = LifespanCategorySaveBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/lifespan/categories/save`, "POST", sentData);
}

export async function deleteCategory(data: any): Promise<{ deleted: boolean; reason?: "has_children" | "in_use" }> {
	const { id } = LifespanCategoryDeleteParamsRequestSchema.parse(data);
	const response = await fetch(`${API_BASE_URL}/lifespan/categories/${id}`, { method: "DELETE" });
	// 409: deletion refused, the body gives the reason
	if (response.status !== 409) {
		await checkResponse(response);
	}
	return response.json();
}

//
// OBJECTS
//
async function getObjectList(search?: string): Promise<Array<LifespanObjectWithStatus>> {
	return fetchJson<Array<LifespanObjectWithStatus>>(withQuery(`${API_BASE_URL}/lifespan/objects`, { search }));
}
export const allObjectsQuery = () =>
	queryOptions({
		queryKey: ["lifespan", "objects", "all"],
		queryFn: () => getObjectList(),
	});

async function getObjectListSorted(sortField: string, sortDirection: string) {
	return fetchJson<Array<LifespanObjectWithStatus>>(
		withQuery(`${API_BASE_URL}/lifespan/objects`, { sort: [sortField, sortDirection] }),
	);
}
export const objectListSort: SortListConfig<LifespanObjectWithStatus> = {
	sortOptions: { localKey: "lifespan_object_list", defaultField: "name", defaultDirection: "asc" },
	queryKey: ["lifespan", "objects"],
	queryFn: getObjectListSorted,
};

async function getObjectDetails(id: string): Promise<LifespanObjectWithStatus> {
	return fetchJson<LifespanObjectWithStatus>(`${API_BASE_URL}/lifespan/objects/${id}`);
}
export const objectDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["lifespan", "objects", id],
		queryFn: () => getObjectDetails(id),
	});

export async function saveObject(data: any) {
	const sentData = LifespanObjectSaveBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/lifespan/objects/save`, "POST", sentData);
}

export async function deleteObject(data: any) {
	const { id } = LifespanObjectDeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/lifespan/objects/${id}`, "DELETE");
}

export async function deleteEvent(data: any) {
	const { objectId, eventId } = LifespanEventDeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/lifespan/objects/${objectId}/events/${eventId}`, "DELETE");
}
