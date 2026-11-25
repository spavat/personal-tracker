import { describe, expect, it } from "vitest";

import { toArtistView } from "./artist.entity.js";

const ID = "00000000-0000-4000-8000-000000000005";

describe("toArtistView", () => {
	it("serves the entity portrait", () => {
		expect(
			toArtistView({ id: ID, name: "Callas", pictureKey: `personal-tracker/entity/${ID}.ab12cd34.avif` }),
		).toEqual({ id: ID, name: "Callas", picture: `/images/entity/${ID}?v=ab12cd34` });
	});

	it("has no picture without portrait", () => {
		expect(toArtistView({ id: ID, name: "Callas", pictureKey: null }).picture).toBeNull();
	});
});
