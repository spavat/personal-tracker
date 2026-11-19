import type { BookOverview } from "@personal-tracker/shared/reading-book";

import { describe, expect, it } from "vitest";

import {
	buildSeriesTree,
	createsCycle,
	descendantsOf,
	parentsOf,
	type SeriesItemRow,
	treeBookIds,
} from "./series.entity.js";

// Terre du Milieu: 1. Bilbo, 2. Le Seigneur des anneaux (1. Communauté, 2. Deux Tours), 3. Silmarillion
// Œuvres de Tolkien: 1. Le Seigneur des anneaux
const book = (bookId: string, seriesId: string, position: number, positionLabel: string | null = String(position)) => ({
	seriesId,
	position,
	positionLabel,
	bookId,
	childSeriesId: null,
});
const sub = (childSeriesId: string, seriesId: string, position: number) => ({
	seriesId,
	position,
	positionLabel: String(position),
	bookId: null,
	childSeriesId,
});
const ITEMS: SeriesItemRow[] = [
	book("silmarillion", "middle-earth", 3),
	sub("lotr", "middle-earth", 2),
	book("hobbit", "middle-earth", 1),
	book("two-towers", "lotr", 2),
	book("fellowship", "lotr", 1),
	sub("lotr", "tolkien", 1),
];
const SERIES = new Map(
	[
		{ id: "middle-earth", title: "Terre du Milieu" },
		{ id: "lotr", title: "Le Seigneur des anneaux" },
		{ id: "tolkien", title: "Œuvres de Tolkien" },
	].map((series) => [series.id, series]),
);
const BOOKS = new Map(["hobbit", "fellowship", "two-towers", "silmarillion"].map((id) => [id, { id } as BookOverview]));

describe("buildSeriesTree", () => {
	it("gives each level in order, the books numbered in reading order over the whole tree", () => {
		expect(buildSeriesTree("middle-earth", ITEMS, SERIES, BOOKS)).toEqual([
			{ kind: "book", positionLabel: "1", readingOrder: 1, book: { id: "hobbit" } },
			{
				kind: "series",
				positionLabel: "2",
				series: { id: "lotr", title: "Le Seigneur des anneaux" },
				items: [
					{ kind: "book", positionLabel: "1", readingOrder: 2, book: { id: "fellowship" } },
					{ kind: "book", positionLabel: "2", readingOrder: 3, book: { id: "two-towers" } },
				],
			},
			{ kind: "book", positionLabel: "3", readingOrder: 4, book: { id: "silmarillion" } },
		]);
	});

	it("numbers from the series shown: a sub-series starts at #1 on its own page", () => {
		const tree = buildSeriesTree("lotr", ITEMS, SERIES, BOOKS);
		expect(tree.map((item) => item.kind === "book" && item.readingOrder)).toEqual([1, 2]);
	});

	it("never loops on a cycle", () => {
		const cyclic = [...ITEMS, sub("middle-earth", "lotr", 3)];
		const tree = buildSeriesTree("middle-earth", cyclic, SERIES, BOOKS);
		const lotr = tree[1];
		expect(lotr.kind === "series" && lotr.items.at(-1)).toMatchObject({
			kind: "series",
			series: { id: "middle-earth" },
			items: [],
		});
	});
});

describe("series relations", () => {
	it("gives the parents of a series, by title", () => {
		// "Œuvres" sorts as "Oeuvres"
		expect(parentsOf("lotr", ITEMS, SERIES).map(({ title }) => title)).toEqual([
			"Œuvres de Tolkien",
			"Terre du Milieu",
		]);
		expect(parentsOf("middle-earth", ITEMS, SERIES)).toEqual([]);
	});

	it("gives the series below, at any depth", () => {
		expect([...descendantsOf("tolkien", ITEMS)]).toEqual(["lotr"]);
		expect(descendantsOf("lotr", ITEMS).size).toBe(0);
	});

	it("gives the distinct books of the whole tree", () => {
		expect(treeBookIds("middle-earth", ITEMS).toSorted()).toEqual([
			"fellowship",
			"hobbit",
			"silmarillion",
			"two-towers",
		]);
		expect(treeBookIds("tolkien", ITEMS).toSorted()).toEqual(["fellowship", "two-towers"]);
	});

	it("finds a cycle: the series itself, or a sub-series holding it", () => {
		expect(createsCycle("lotr", ["lotr"], ITEMS)).toBe(true);
		expect(createsCycle("lotr", ["middle-earth"], ITEMS)).toBe(true);
		expect(createsCycle("middle-earth", ["tolkien"], ITEMS)).toBe(false);
	});
});
