import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

// shared between the page component and its route loader
export interface YearQueryConfig<T> {
	queryKey: Array<string>;
	queryFn: (start: string, end: string) => Promise<T>;
}

// the query useYearChanger runs for a year, also usable in route loaders
export function yearQuery<T>({ queryKey, queryFn }: YearQueryConfig<T>, period: string) {
	return queryOptions({
		queryKey: [...queryKey, "year", period],
		queryFn: () => {
			const baseDay = Temporal.PlainDate.from(`${period}-01-01`);
			return queryFn(baseDay.toString(), baseDay.with({ month: 12, day: 31 }).toString());
		},
	});
}

export function useYearChanger<T>({
	navigationIsDisabled,
	initialPeriod,
	...config
}: YearQueryConfig<T> & {
	navigationIsDisabled: (period: string, delta: "previous" | "next") => boolean;
	initialPeriod?: string;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const period = initialPeriod ?? String(Temporal.Now.plainDateISO().year);
	const baseDay = Temporal.PlainDate.from(`${period}-01-01`);

	const listQuery = useSuspenseQuery(yearQuery(config, period));

	function changePeriod(delta: "previous" | "next") {
		if (navigationIsDisabled(period, delta)) {
			return;
		}
		const newBaseDay = baseDay.add({ years: delta === "previous" ? -1 : 1 });
		const newPath = location.pathname.replace(`/${period}`, `/${newBaseDay.year}`);
		navigate({ to: newPath });
	}

	return [
		period,
		listQuery,
		() => changePeriod("previous"),
		() => changePeriod("next"),
		() => !navigationIsDisabled(period, "previous"),
		() => !navigationIsDisabled(period, "next"),
	] as const;
}
