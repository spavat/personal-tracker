import { describe, expect, it } from "vitest";

import { portraitKey, portraitUrl } from "./entity.entity.js";

describe("portrait", () => {
	it("serves the stored portrait through the images proxy, with its version", () => {
		expect(portraitUrl("e1", portraitKey("e1", "0a1b2c3d"))).toBe("/images/entity/e1?v=0a1b2c3d");
	});

	it("has no URL without key", () => {
		expect(portraitUrl("e1", null)).toBeNull();
	});
});
