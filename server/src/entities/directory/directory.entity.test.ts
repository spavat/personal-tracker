import type { EntityDirectoryItem } from "@personal-tracker/shared/entity";

import { describe, expect, it } from "vitest";

import { countByRole, hasCredits, sortDirectory, toDirectoryItems } from "./directory.entity.js";

const entity = (id: string, name: string) => ({
	id,
	kind: "person" as const,
	name,
	sortName: null,
	realName: null,
	pictureKey: null,
});
const NO_CREDITS = { show: new Map(), books: [], programs: [], episodes: [] };

// an item credited only on `books` books (as author)
function item(id: string, name: string, books = 0): EntityDirectoryItem {
	const [directory] = toDirectoryItems([entity(id, name)], {
		...NO_CREDITS,
		books: books
			? [{ entityId: id, role: "author", ids: Array.from({ length: books }, (_, i) => `${id}${i}`) }]
			: [],
	});
	return directory;
}

describe("countByRole", () => {
	it("counts a work once in the total, and once in each of its roles", () => {
		const counts = countByRole(
			[
				{ entityId: "a", role: "author", ids: ["b1", "b2"] },
				{ entityId: "a", role: "illustrator", ids: ["b1"] },
				{ entityId: null, role: "author", ids: ["b3"] },
			],
			["author", "illustrator", "preface"],
		);
		expect([...counts]).toEqual([["a", { total: 2, author: 2, illustrator: 1, preface: 0 }]]);
	});
});

describe("toDirectoryItems", () => {
	it("breaks each entity's credits down by module and role, 0 where it is not credited", () => {
		const [ana, bob] = toDirectoryItems([entity("a", "Ana"), entity("b", "Bob")], {
			show: new Map([["a", { spectacles: 2, performances: 3 }]]),
			books: [
				{ entityId: "b", role: "author", ids: ["b1"] },
				{ entityId: "b", role: "illustrator", ids: ["b1"] },
			],
			programs: [{ entityId: "a", role: "network", ids: ["p1", "p2"] }],
			episodes: [
				{ entityId: "a", role: "guest", ids: ["e1"] },
				{ entityId: "a", role: "host", ids: ["e1", "e2"] },
			],
		});
		expect(ana).toMatchObject({
			id: "a",
			picture: null,
			book: { books: 0, author: 0, illustrator: 0, preface: 0, translator: 0, publisher: 0 },
			show: { spectacles: 2, performances: 3 },
			program: { programs: 2, host: 0, producer: 0, network: 2 },
			episode: { episodes: 2, host: 2, guest: 1, interviewee: 0 },
		});
		// author and illustrator of the same book: one book
		expect(bob.book).toEqual({ books: 1, author: 1, illustrator: 1, preface: 0, translator: 0, publisher: 0 });
		expect(bob.show).toEqual({ spectacles: 0, performances: 0 });
	});
});

describe("hasCredits", () => {
	it("is true as soon as one module credits the entity", () => {
		expect(hasCredits(item("a", "Ana"))).toBe(false);
		expect(hasCredits(item("a", "Ana", 1))).toBe(true);
	});
});

describe("sortDirectory", () => {
	const items = [item("a", "Ana", 1), item("b", "Bob", 3), item("c", "Cyd", 1)];
	const ids = (list: EntityDirectoryItem[]) => list.map(({ id }) => id);

	it("keeps the name order, or reverses it", () => {
		expect(ids(sortDirectory(items, "name", "asc"))).toEqual(["a", "b", "c"]);
		expect(ids(sortDirectory(items, "name", "desc"))).toEqual(["c", "b", "a"]);
	});

	it("sorts by a count, equal counts staying in name order", () => {
		expect(ids(sortDirectory(items, "books", "desc"))).toEqual(["b", "a", "c"]);
		expect(ids(sortDirectory(items, "books", "asc"))).toEqual(["a", "c", "b"]);
	});

	it("sorts by name on an unknown field", () => {
		expect(ids(sortDirectory(items, "pictureKey", "asc"))).toEqual(["a", "b", "c"]);
	});
});
