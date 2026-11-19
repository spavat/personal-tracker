import type { BookOverview, SeriesTreeItem } from "@personal-tracker/shared/reading-book";

// A series holds items in order: books and sub-series (series of their own, possibly in several parents).
// These functions work on all the items (a few hundred at most) and never loop, even on a cycle.

export interface SeriesItemRow {
	seriesId: string;
	position: number;
	positionLabel: string | null;
	bookId: string | null;
	childSeriesId: string | null;
}

export type SeriesRef = { id: string; title: string };

function itemsOf(seriesId: string, items: SeriesItemRow[]) {
	return items.filter((item) => item.seriesId === seriesId).toSorted((a, b) => a.position - b.position);
}

// the series directly holding this one, by title
export function parentsOf(seriesId: string, items: SeriesItemRow[], seriesById: Map<string, SeriesRef>) {
	return [...new Set(items.filter((item) => item.childSeriesId === seriesId).map((item) => item.seriesId))]
		.flatMap((id) => seriesById.get(id) ?? [])
		.toSorted((a, b) => a.title.localeCompare(b.title));
}

// every series below this one, at any depth
export function descendantsOf(seriesId: string, items: SeriesItemRow[]) {
	const found = new Set<string>();
	const toVisit = [seriesId];
	while (toVisit.length) {
		const current = toVisit.pop()!;
		for (const item of items) {
			if (item.seriesId === current && item.childSeriesId && !found.has(item.childSeriesId)) {
				found.add(item.childSeriesId);
				toVisit.push(item.childSeriesId);
			}
		}
	}
	return found;
}

// Holding these sub-series would make the series hold itself: one of them is the series, or holds it
export function createsCycle(seriesId: string, childIds: string[], items: SeriesItemRow[]) {
	return childIds.some((childId) => childId === seriesId || descendantsOf(childId, items).has(seriesId));
}

// the distinct books of the whole tree
export function treeBookIds(seriesId: string, items: SeriesItemRow[]) {
	const seriesIds = [seriesId, ...descendantsOf(seriesId, items)];
	return [
		...new Set(
			items.filter((item) => seriesIds.includes(item.seriesId) && item.bookId).map((item) => item.bookId!),
		),
	];
}

// The tree of the series, each level in order. The books get their reading order ("#n"): depth-first over
// the whole tree, so it follows any insertion. A sub-series already open above it is shown without its items.
export function buildSeriesTree(
	seriesId: string,
	items: SeriesItemRow[],
	seriesById: Map<string, SeriesRef>,
	booksById: Map<string, BookOverview>,
) {
	let readingOrder = 0;
	function level(id: string, open: Set<string>): SeriesTreeItem[] {
		return itemsOf(id, items).flatMap((item): SeriesTreeItem[] => {
			if (item.bookId) {
				const book = booksById.get(item.bookId);
				return book
					? [{ kind: "book", positionLabel: item.positionLabel, readingOrder: ++readingOrder, book }]
					: [];
			}
			const child = item.childSeriesId ? seriesById.get(item.childSeriesId) : undefined;
			if (!child) {
				return [];
			}
			const children = open.has(child.id) ? [] : level(child.id, new Set([...open, child.id]));
			return [{ kind: "series", positionLabel: item.positionLabel, series: child, items: children }];
		});
	}
	return level(seriesId, new Set([seriesId]));
}
