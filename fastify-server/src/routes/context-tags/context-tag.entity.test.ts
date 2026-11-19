import { describe, expect, it } from "vitest";

import { buildContextTag } from "./context-tag.entity";

describe("buildContextTag", () => {
	it("adds a generated id and keeps the input fields", () => {
		const tag = buildContextTag({ name: "Genre", tags: ["scifi", "fantasy"] });

		expect(tag).toMatchObject({ name: "Genre", tags: ["scifi", "fantasy"] });
		expect(tag.id).toEqual(expect.any(String));
	});

	it("generates a distinct id on each call", () => {
		const a = buildContextTag({ name: "A", tags: [] });
		const b = buildContextTag({ name: "A", tags: [] });
		expect(a.id).not.toBe(b.id);
	});
});
