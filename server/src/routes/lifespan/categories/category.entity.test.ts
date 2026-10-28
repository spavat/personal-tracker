import { describe, expect, it } from "vitest";

import { buildLifespanCategory, isOwnDescendant } from "./category.entity";

describe("buildLifespanCategory", () => {
	it("adds a generated id and keeps the input fields", () => {
		const category = buildLifespanCategory({ name: "Clothes", parentId: null });

		expect(category).toMatchObject({ name: "Clothes", parentId: null });
		expect(category.id).toEqual(expect.any(String));
	});

	it("generates a distinct id on each call", () => {
		const a = buildLifespanCategory({ name: "Clothes", parentId: null });
		const b = buildLifespanCategory({ name: "Clothes", parentId: null });
		expect(a.id).not.toBe(b.id);
	});
});

describe("isOwnDescendant", () => {
	const categories = [
		{ id: "a", parentId: null },
		{ id: "b", parentId: "a" },
		{ id: "c", parentId: "b" },
		{ id: "d", parentId: null },
	];

	it("is true for the category itself and its descendants", () => {
		expect(isOwnDescendant("a", "a", categories)).toBe(true);
		expect(isOwnDescendant("a", "c", categories)).toBe(true);
	});

	it("is false for another branch or an ancestor", () => {
		expect(isOwnDescendant("b", "d", categories)).toBe(false);
		expect(isOwnDescendant("c", "a", categories)).toBe(false);
	});

	it("stops on a loop already stored", () => {
		expect(
			isOwnDescendant("d", "x", [
				{ id: "x", parentId: "y" },
				{ id: "y", parentId: "x" },
			]),
		).toBe(false);
	});
});
