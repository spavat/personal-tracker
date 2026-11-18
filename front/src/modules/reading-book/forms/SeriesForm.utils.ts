// The label pre-filled for a book added to a series: the number after the highest whole number among
// the labels ("1", "2", "2.5" → "3"), "1" when none is a number
export function nextSeriesLabel(labels: string[]) {
	const numbers = labels.map((label) => Number.parseFloat(label)).filter((value) => Number.isFinite(value));
	return String(numbers.length ? Math.floor(Math.max(...numbers)) + 1 : 1);
}

// every series holding this one, at any depth (from the parents of each series)
export function ancestorIds(seriesId: string, series: Array<{ id: string; parents: Array<{ id: string }> }>) {
	const parentsById = new Map(series.map((item) => [item.id, item.parents.map(({ id }) => id)]));
	const found = new Set<string>();
	const toVisit = [seriesId];
	while (toVisit.length) {
		for (const parentId of parentsById.get(toVisit.pop()!) ?? []) {
			if (!found.has(parentId)) {
				found.add(parentId);
				toVisit.push(parentId);
			}
		}
	}
	return found;
}
