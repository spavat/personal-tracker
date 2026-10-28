import {
	ContextTag,
	DeleteContextTagParamsRequestSchema,
	ListResponseSchema,
	SaveContextTagRequestSchema,
} from "@personal-tracker/shared/context-tag";
import { queryOptions } from "@tanstack/react-query";

import { fetchJson, sendJson } from "../../api-utils";
import { API_BASE_URL } from "../../config";

async function getContextTags(): Promise<Array<ContextTag>> {
	const data = await fetchJson(`${API_BASE_URL}/context-tags/list`);
	const parsedResponse = ListResponseSchema.safeParse(data);
	if (!parsedResponse.success) {
		console.error(parsedResponse.error);
		return [];
	}
	return parsedResponse.data;
}
export const contextTagsQuery = () =>
	queryOptions({
		queryKey: ["context-tags"],
		queryFn: () => getContextTags(),
	});

export async function save(data: any) {
	const sentData = SaveContextTagRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/context-tags/save`, "POST", sentData);
}

export async function deleteItem(data: any) {
	const { id } = DeleteContextTagParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/context-tags/${id}`, "DELETE");
}
