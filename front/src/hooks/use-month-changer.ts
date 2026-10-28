import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "@tanstack/react-router";

// shared between the page component and its route loader
export interface MonthQueryConfig<T> {
	queryKey: Array<string>;
	queryFn: (start: string, end: string) => Promise<T>;
}

// the query useMonthChanger runs for a month (YYYY-MM), also usable in route loaders
export function monthQuery<T>({ queryKey, queryFn }: MonthQueryConfig<T>, period: string) {
	const yearMonth = Temporal.PlainYearMonth.from(period);
	const startDateTemporal = yearMonth.toPlainDate({ day: 1 });
	const lastDayTemporal = yearMonth.toPlainDate({ day: yearMonth.daysInMonth });
	return queryOptions({
		queryKey: [...queryKey, "month", period],
		queryFn: () => queryFn(startDateTemporal.toString(), lastDayTemporal.toString()),
	});
}

// previous/next month navigation only, for pages loading their data another way
export function useMonthNavigation({
	navigationIsDisabled,
	period,
}: {
	navigationIsDisabled: (period: string, delta: "previous" | "next") => boolean;
	period: string;
}) {
	const navigate = useNavigate();
	const location = useLocation();

	function changePeriod(delta: "previous" | "next") {
		if (navigationIsDisabled(period, delta)) {
			return;
		}

		const yearMonth = Temporal.PlainYearMonth.from(period);
		const newPeriod = yearMonth.add({ months: delta === "previous" ? -1 : 1 });
		const newPath = location.pathname.replace(`/${period}`, `/${newPeriod.toString()}`);
		navigate({ to: newPath });
	}

	return [
		() => changePeriod("previous"),
		() => changePeriod("next"),
		() => !navigationIsDisabled(period, "previous"),
		() => !navigationIsDisabled(period, "next"),
	] as const;
}

export function useMonthChanger<T>({
	navigationIsDisabled,
	period,
	...config
}: MonthQueryConfig<T> & {
	navigationIsDisabled: (period: string, delta: "previous" | "next") => boolean;
	period: string;
}) {
	const listQuery = useSuspenseQuery(monthQuery(config, period));
	return [listQuery, ...useMonthNavigation({ navigationIsDisabled, period })] as const;
}
