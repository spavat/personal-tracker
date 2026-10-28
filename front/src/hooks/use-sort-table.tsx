import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useTransition } from "react";

import { readStoredValue, useStoredValue } from "./stored-value";

interface Columns {
	name: string;
	colName?: string;
	isSortable: boolean;
}
// shared between the list component and its route loader
export interface SortListConfig<T> {
	sortOptions: {
		localKey: string;
		defaultField: string;
		defaultDirection: string;
	};
	queryKey: Array<string>;
	queryFn: (sortField: string, sortDirection: string) => Promise<Array<T>>;
}
interface SortTableParams<T> extends SortListConfig<T> {
	columnsList: Array<Columns | null>;
}

function sortedListQuery<T>({ queryKey, queryFn }: SortListConfig<T>, sortField: string, sortDirection: string) {
	return queryOptions({
		queryKey: [...queryKey, sortField, sortDirection],
		queryFn: () => queryFn(sortField, sortDirection),
	});
}

// for route loaders: the query useSortTable will run, with the sort currently stored
export function storedSortQuery<T>(config: SortListConfig<T>) {
	const { localKey, defaultField, defaultDirection } = config.sortOptions;
	return sortedListQuery(
		config,
		readStoredValue(`${localKey}_sort_field`, defaultField),
		readStoredValue(`${localKey}_sort_direction`, defaultDirection),
	);
}

export function useSortTable<T>({ columnsList, ...config }: SortTableParams<T>) {
	const { sortOptions } = config;
	const [sortField, setSortField] = useStoredValue(`${sortOptions.localKey}_sort_field`, sortOptions.defaultField);
	const [sortDirection, setSortDirection] = useStoredValue(
		`${sortOptions.localKey}_sort_direction`,
		sortOptions.defaultDirection,
	);

	const listQuery = useSuspenseQuery(sortedListQuery(config, sortField, sortDirection));
	const [isPending, startTransition] = useTransition();

	function clickHeader(columnName: string) {
		// transition: keep the current list displayed while the new sort loads
		startTransition(() => {
			if (columnName === sortField) {
				// change direction
				setSortDirection(sortDirection === "asc" ? "desc" : "asc");
			} else {
				// change column
				setSortField(columnName);
				setSortDirection("asc");
			}
		});
	}

	const headers = columnsList.map((col) => {
		if (!col) {
			return <th key="empty"></th>;
		}
		if (!col.isSortable) {
			return <th key={col.name}>{col.name}</th>;
		}
		return (
			<th key={col.name}>
				<a onClick={() => clickHeader(col.colName ?? col.name)}>{col.name}</a>
				{sortField !== col.colName && <i className="fa-solid fa-sort"></i>}
				{sortField === col.colName && (
					<>
						{sortDirection === "asc" ? (
							<i className="fa-solid fa-sort-up"></i>
						) : (
							<i className="fa-solid fa-sort-down"></i>
						)}
					</>
				)}
			</th>
		);
	});
	return {
		query: listQuery,
		headers,
		isPending,
	};
}
