import { afterEach, describe, expect, it, vi } from "vitest";

import { SteamConnector } from "./steam.connector";

// trimmed from a real GetOwnedGames response
const OWNED_GAMES = {
	response: {
		game_count: 4,
		games: [
			{
				appid: 70,
				name: "Half-Life",
				playtime_forever: 0,
				playtime_windows_forever: 0,
				playtime_deck_forever: 0,
				rtime_last_played: 0,
			},
			{
				appid: 220,
				name: "Half-Life 2",
				playtime_forever: 65,
				// old playtime isn't split by platform
				playtime_windows_forever: 0,
				playtime_linux_forever: 0,
				playtime_deck_forever: 0,
				rtime_last_played: 0,
			},
			{
				appid: 1145350,
				name: "Hades II",
				playtime_forever: 6720,
				playtime_windows_forever: 6720,
				playtime_deck_forever: 0,
				rtime_last_played: 1768761600,
			},
			{ appid: 1942280, name: "Brotato", playtime_forever: 4620, playtime_deck_forever: 600 },
			// last played before Steam recorded it
			{ appid: 400, name: "Portal", playtime_forever: 253, rtime_last_played: 86400 },
		],
	},
};

const connector = () => new SteamConnector({ apiKey: "KEY", steamId: "76561190000000000" });

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("SteamConnector.parse", () => {
	it("keeps the played games only, in seconds", () => {
		const totals = connector().parse(OWNED_GAMES);
		expect(totals.map((t) => [t.storeGameId, t.origin, t.seconds])).toEqual([
			["220", "steam", 65 * 60],
			["1145350", "steam", 6720 * 60],
			["1942280", "steam", (4620 - 600) * 60],
			["1942280", "steam-deck", 600 * 60],
			["400", "steam", 253 * 60],
		]);
	});

	it("gives the name and the last session, none when Steam says 0", () => {
		const [halfLife2, hades] = connector().parse(OWNED_GAMES);
		expect(halfLife2).toEqual({ storeGameId: "220", name: "Half-Life 2", origin: "steam", seconds: 3900 });
		expect(hades.lastPlayed).toBe("2026-01-18T18:40:00Z");
	});

	it("reads Steam's 1970-01-02 placeholder as no last session", () => {
		expect(
			connector()
				.parse(OWNED_GAMES)
				.find((t) => t.storeGameId === "400"),
		).not.toHaveProperty("lastPlayed");
	});

	it("returns nothing for an empty library", () => {
		expect(connector().parse({ response: { games: [] } })).toEqual([]);
	});
});

describe("SteamConnector", () => {
	it("is configured with a key and a SteamID", async () => {
		expect(await connector().isConfigured()).toBe(true);
		expect(await new SteamConnector({ apiKey: "", steamId: "1" }).isConfigured()).toBe(false);
	});

	it("asks for the app info and the free games", async () => {
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(OWNED_GAMES)));
		vi.stubGlobal("fetch", fetch);

		expect(await connector().fetchRaw()).toEqual(OWNED_GAMES);
		const url = new URL(fetch.mock.calls[0][0]);
		expect(url.searchParams.get("steamid")).toBe("76561190000000000");
		expect(url.searchParams.get("include_appinfo")).toBe("1");
		expect(url.searchParams.get("include_played_free_games")).toBe("1");
	});

	it("fails on the empty response of a private profile", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: {} }))));
		await expect(connector().fetchRaw()).rejects.toThrow(/privés/);
	});

	it("fails on an HTTP error", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));
		await expect(connector().fetchRaw()).rejects.toThrow("Steam : erreur 403");
	});
});
