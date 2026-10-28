import {
	SportActivity,
	CropBodyRequestSchema,
	DeleteParamsRequestSchema,
	SaveBodyRequestSchema,
	UpdateSegmentsBodyRequestSchema,
} from "@personal-tracker/shared/sport";
import { queryOptions } from "@tanstack/react-query";

import type { MonthQueryConfig } from "../../hooks/use-month-changer";

import { fetchJson, sendJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

async function getActivityList(from?: string, to?: string): Promise<Array<SportActivity>> {
	const params = new URLSearchParams();
	if (from) params.set("from", from);
	if (to) params.set("to", to);
	const qs = params.toString();
	return fetchJson(`${API_BASE_URL}/sport/list${qs ? `?${qs}` : ""}`);
}
export const activityHistory: MonthQueryConfig<Array<SportActivity>> = {
	queryKey: ["sport", "activities"],
	queryFn: getActivityList,
};
export const allActivitiesQuery = () =>
	queryOptions({
		queryKey: ["sport", "activities", "all"],
		queryFn: () => getActivityList(),
	});

async function getActivityDetails(id: string): Promise<SportActivity> {
	return fetchJson(withQuery(`${API_BASE_URL}/sport/id`, { id }));
}
export const activityDetailsQuery = (id: string) =>
	queryOptions({
		queryKey: ["sport", "activity", id],
		queryFn: () => getActivityDetails(id),
	});

export function getActivityDownloadUrl(id: string): string {
	return withQuery(`${API_BASE_URL}/sport/download`, { id });
}

export function getActivityThumbnailUrl(id: string): string {
	return `${API_BASE_URL}/images/sport/${id}/thumbnail`;
}

export async function save(data: any): Promise<any> {
	const sentData = SaveBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/sport/save`, "POST", sentData);
}

export async function deleteActivity(data: any): Promise<any> {
	const { id } = DeleteParamsRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/sport/${id}`, "DELETE");
}

export async function updateSegments(data: any): Promise<any> {
	const sentData = UpdateSegmentsBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/sport/segments`, "POST", sentData);
}

export async function cropActivity(data: any): Promise<any> {
	const sentData = CropBodyRequestSchema.parse(data);
	return sendJson(`${API_BASE_URL}/sport/crop`, "POST", sentData);
}
