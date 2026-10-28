import { useQuery } from "@tanstack/react-query";

export function useSearch<T>({
	queryKey,
	queryFn,
	search,
}: {
	queryKey: Array<string>;
	queryFn: (search: string) => Promise<Array<T>>;
	search: string;
}) {
	return useQuery({
		queryKey: [...queryKey, search],
		queryFn: () => queryFn(search),
		enabled: search !== "",
	});
}
