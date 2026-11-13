import { afterEach, describe, expect, it, vi } from "vitest";

import { SteamStore } from "./steam-store";

const json = (body: unknown) => new Response(JSON.stringify(body));
const noWait = () => Promise.resolve();

// trimmed from real responses
const BROTATO = {
	"1942280": {
		success: true,
		data: {
			type: "game",
			name: "Brotato",
			developers: ["Blobfish"],
			publishers: ["Blobfish"],
			header_image:
				"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1942280/h/header_alt_assets_4.jpg",
			capsule_image:
				"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1942280/c/capsule_231x87.jpg",
			capsule_imagev5:
				"https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1942280/c/capsule_184x69.jpg",
		},
	},
};
const HADES_SEARCH = {
	total: 3,
	items: [
		{ type: "app", id: 1145350, name: "Hades II" },
		{ type: "app", id: 1145360, name: "Hades" },
		{ type: "app", id: 755800, name: "Hades' Star" },
	],
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SteamStore.details", () => {
	it("gives the first developer and publisher, the 184x69 capsule and the header", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(BROTATO)));
		expect(await new SteamStore(noWait).details("1942280")).toEqual({
			developer: "Blobfish",
			publisher: "Blobfish",
			capsule: BROTATO["1942280"].data.capsule_imagev5,
			header: BROTATO["1942280"].data.header_image,
		});
	});

	it("returns null for an app Steam doesn't know", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ "999": { success: false } })));
		expect(await new SteamStore(noWait).details("999")).toBeNull();
	});
});

describe("SteamStore.findAppId", () => {
	it("takes the exact name, not the first result", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(HADES_SEARCH)));
		expect(await new SteamStore(noWait).findAppId("Hades")).toBe("1145360");
	});

	it("finds nothing without an exact match", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(HADES_SEARCH)));
		expect(await new SteamStore(noWait).findAppId("Hades III")).toBeUndefined();
	});
});

describe("SteamStore rate limit", () => {
	it("waits between two calls", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockImplementation(async () => json(HADES_SEARCH)),
		);
		const wait = vi.fn().mockResolvedValue(undefined);
		const store = new SteamStore(wait);

		await store.findAppId("Hades");
		expect(wait).not.toHaveBeenCalled();
		await store.findAppId("Hades");
		expect(wait).toHaveBeenCalledTimes(1);
		expect(wait.mock.calls[0][0]).toBeGreaterThan(1000);
	});
});
