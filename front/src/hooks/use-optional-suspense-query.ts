import { type QueryKey, type UseSuspenseQueryOptions, useSuspenseQueries } from "@tanstack/react-query";

// useSuspenseQuery that can be skipped, for a form used both to create (no options: undefined data) and to edit
export function useOptionalSuspenseQuery<TQueryFnData, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
	options: UseSuspenseQueryOptions<TQueryFnData, Error, TData, TQueryKey> | undefined,
): TData | undefined {
	const queries: Array<UseSuspenseQueryOptions<TQueryFnData, Error, TData, TQueryKey>> = options ? [options] : [];
	const results = useSuspenseQueries({ queries });
	return results[0]?.data as TData | undefined;
}
