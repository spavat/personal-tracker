import { describe, expect, it } from "vitest";

import { toArtistView } from "./artist.entity";

describe("toArtistView", () => {
	it("adds the main photo url", () => {
		expect(toArtistView({ id: 5, name: "Callas", pictureId: "22222222-2222-4222-8222-222222222222" })).toEqual({
			id: 5,
			name: "Callas",
			pictureId: "22222222-2222-4222-8222-222222222222",
			pictureUrl: "/images/show/22222222-2222-4222-8222-222222222222",
		});
	});

	it("has no url without main photo", () => {
		expect(toArtistView({ id: 5, name: "Callas", pictureId: null }).pictureUrl).toBeNull();
	});
});
