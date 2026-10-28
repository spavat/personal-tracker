import { GetDailyCalendarResponse, GetMonthlyCalendarResponse } from "@personal-tracker/shared/calendar";
import { queryOptions } from "@tanstack/react-query";

import type { MonthQueryConfig } from "../../hooks/use-month-changer";

import { fetchJson, withQuery } from "../../api-utils";
import { API_BASE_URL } from "../../config";

async function getPeriodCalendar(from: string, to: string) {
	return fetchJson<GetMonthlyCalendarResponse>(withQuery(`${API_BASE_URL}/calendar/period`, { from, to }));
}
export const monthCalendar: MonthQueryConfig<GetMonthlyCalendarResponse> = {
	queryKey: ["calendar"],
	queryFn: getPeriodCalendar,
};

async function getDailyCalendar(date: string) {
	return fetchJson<GetDailyCalendarResponse>(withQuery(`${API_BASE_URL}/calendar/daily`, { date }));
}
export const dailyCalendarQuery = (date: string) =>
	queryOptions({
		queryKey: ["calendar", date],
		queryFn: () => getDailyCalendar(date),
	});
