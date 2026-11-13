import { afterEach, describe, expect, it, vi } from "vitest";

import { GogConnector } from "./gog.connector";

// trimmed from a real profile stats response (user id replaced)
const witcher = {
	game: {
		id: "1495134320",
		title: "The Witcher 3: Wild Hunt — Remastered",
		url: "/en/game/the_witcher_3_wild_hunt_game_of_the_year_edition",
		achievementSupport: true,
		image: "https://images.gog-statics.com/ee9c88c3af91027d9121906fd0e838f11e890fbf74c9c9412e54622abc299f0a",
	},
	stats: {
		"10000000000000000": { achievementsPercentage: 41, playtime: 5091, lastSession: "2021-12-11T12:38:55+00:00" },
	},
};
const totalAnnihilation = {
	game: { id: "1207658880", title: "Total Annihilation: Commander Pack", achievementSupport: false },
	stats: { "10000000000000000": { playtime: 368, lastSession: "2020-06-17T18:29:52+00:00" } },
};
const unplayed = { game: { id: "1", title: "Neurodeck: Psychological Deckbuilder" }, stats: [] };

const page = (number: number, pages: number, items: unknown[]) => ({
	page: number,
	limit: 50,
	pages,
	total: 3,
	_embedded: { items },
});

const connector = () => new GogConnector({ username: "someone" });

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("GogConnector.parse", () => {
	it("keeps the played games, in seconds, with their last session and image", () => {
		expect(connector().parse([witcher, unplayed, totalAnnihilation])).toEqual([
			{
				storeGameId: "1495134320",
				name: "The Witcher 3: Wild Hunt — Remastered",
				origin: "gog",
				seconds: 5091 * 60,
				lastPlayed: "2021-12-11T12:38:55Z",
				image: witcher.game.image,
			},
			{
				storeGameId: "1207658880",
				name: "Total Annihilation: Commander Pack",
				origin: "gog",
				seconds: 368 * 60,
				lastPlayed: "2020-06-17T18:29:52Z",
			},
		]);
	});

	it("returns nothing for an empty profile", () => {
		expect(connector().parse([])).toEqual([]);
	});
});

describe("GogConnector.fetchRaw", () => {
	it("walks every page", async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify(page(1, 2, [witcher, unplayed]))))
			.mockResolvedValueOnce(new Response(JSON.stringify(page(2, 2, [totalAnnihilation]))));
		vi.stubGlobal("fetch", fetch);

		expect(await connector().fetchRaw()).toEqual([witcher, unplayed, totalAnnihilation]);
		expect(fetch.mock.calls.map(([url]) => new URL(url).searchParams.get("page"))).toEqual(["1", "2"]);
		expect(fetch.mock.calls[0][0]).toContain("/u/someone/games/stats");
	});

	it("hints at a private profile on 403", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));
		await expect(connector().fetchRaw()).rejects.toThrow("GOG : erreur 403");
		await expect(connector().fetchRaw()).rejects.toThrow(/privé/);
	});

	it("is configured with a username", async () => {
		expect(await connector().isConfigured()).toBe(true);
		expect(await new GogConnector({ username: "" }).isConfigured()).toBe(false);
	});
});
