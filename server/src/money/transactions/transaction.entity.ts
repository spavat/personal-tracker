type Sortable = { date: string | null; time?: string | null };

function compareByDateThenTime(t1: Sortable, t2: Sortable) {
	const t1date = t1.date ?? "";
	const t2date = t2.date ?? "";
	if (t1date !== t2date) {
		return t1date < t2date ? -1 : 1;
	}
	const t1time = t1.time ?? "00:00";
	const t2time = t2.time ?? "00:00";
	if (t1time !== t2time) {
		return t1time < t2time ? -1 : 1;
	}
	return 0;
}

export function mergeAndSortTransactions<D extends Sortable, S extends Sortable>(direct: D[], sub: S[]): Array<D | S> {
	return [...direct, ...sub].toSorted(compareByDateThenTime);
}
