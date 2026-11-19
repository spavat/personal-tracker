import { describe, expect, it } from "vitest";

import { sortByNames } from "./tag.entity";

describe("sortByNames", () => {
	it("sorts by name ascending", () => {
		expect(
			[{ name: "Charlie" }, { name: "alpha" }, { name: "Bravo" }].sort(sortByNames).map((n) => n.name),
		).toEqual(["alpha", "Bravo", "Charlie"]);
	});
});
