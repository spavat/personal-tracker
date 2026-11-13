import { describe, expect, it } from "vitest";

import { accentInsensitiveRegex } from "./mongo-search";

describe("accentInsensitiveRegex", () => {
	it("matches accented text from an unaccented search", () => {
		expect(accentInsensitiveRegex("anais").test("Anaïs")).toBe(true);
		expect(accentInsensitiveRegex("opera").test("L'Opéra de Paris")).toBe(true);
	});

	it("matches unaccented text from an accented search", () => {
		expect(accentInsensitiveRegex("Anaïs").test("anais")).toBe(true);
	});

	it("is case-insensitive on accented letters", () => {
		expect(accentInsensitiveRegex("ELODIE").test("Élodie")).toBe(true);
	});

	it("does not match a different word", () => {
		expect(accentInsensitiveRegex("anais").test("Anaëlle")).toBe(false);
	});

	it("escapes regex special characters", () => {
		expect(() => accentInsensitiveRegex("(a+")).not.toThrow();
		expect(accentInsensitiveRegex("a.b").test("axb")).toBe(false);
		expect(accentInsensitiveRegex("a.b").test("a.b")).toBe(true);
	});

	it("matches everything on an empty search", () => {
		expect(accentInsensitiveRegex("").test("anything")).toBe(true);
	});
});
