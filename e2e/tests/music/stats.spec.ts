import type { Page } from "@playwright/test";

import { expect, resetDb, test } from "../../fixtures";

const currentYear = new Date().getFullYear();

function metric(page: Page, name: string) {
	return page.locator(".headlines .metric").filter({ hasText: name }).locator(".value");
}

function genreBars(page: Page) {
	return page.locator(".stats-music-genre .recharts-wrapper").first().locator(".recharts-bar-rectangle");
}

test.describe("Music - Stats", () => {
	test.afterEach(resetDb);

	test("stats root redirects to the current year", async ({ page }) => {
		await page.goto("/music/stats");
		await expect(page).toHaveURL(`/music/stats/${currentYear}`);
	});

	test("a complete year", async ({ page }) => {
		await page.goto("/music/stats/2025");
		await expect(metric(page, "Total")).toHaveText("41min");
		await expect(metric(page, "Moyenne par jour")).toHaveText("0min");
		await expect(page.locator(".headlines .metric").first()).toContainText("(sur 365 jours)");
		await expect(metric(page, "Albums / EPs")).toHaveText("1");
		// No release date
		await expect(page.locator(".stats .recharts-wrapper").last()).toContainText("XXXX");
	});

	test("the year in progress", async ({ page }) => {
		await page.goto("/music/stats/2026");
		await expect(metric(page, "Total")).toHaveText("5h 55min*");
		await expect(metric(page, "Albums / EPs")).toHaveText("7*");
	});

	test("genres are grouped by main genre", async ({ page }) => {
		await page.goto("/music/stats/2026");
		const genres = page.locator(".stats-music-genre .recharts-wrapper").first();
		// Grunge counts in Rock, Electro and Techno in Electronic, Soundtrack has no main genre
		await expect(genres.locator(".recharts-yAxis-tick-labels text")).toHaveText([
			"Rock",
			"Electronic",
			"Soundtrack",
		]);
		await expect(genres.locator(".recharts-label-list text")).toHaveText(["205", "109", "41"]);

		await genreBars(page).nth(1).click();
		await expect(page.getByRole("heading", { name: "Répartition par genres : (Electronic)" })).toBeVisible();
		const artists = page.locator(".stats-music-genre .recharts-wrapper").nth(1);
		await expect(artists.locator(".recharts-yAxis-tick-labels text")).toHaveText(["Daft Punk", "Justice", "Mehdi"]);

		await genreBars(page).nth(1).click();
		await expect(page.getByRole("heading", { name: "Répartition par genres", exact: true })).toBeVisible();
		await expect(page.locator(".stats-music-genre .recharts-wrapper")).toHaveCount(1);
	});

	test("navigate between years", async ({ page }) => {
		await page.goto("/music/stats/2026");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page).toHaveURL("/music/stats/2025");
		await expect(metric(page, "Albums / EPs")).toHaveText("1");

		await page.goto("/music/stats/2024");
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();
		await page.goto(`/music/stats/${currentYear}`);
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
	});

	test("release years", async ({ page }) => {
		await page.goto("/music/stats/2026");
		// Durations by release year: 1991, 1994, 1997 (listened twice), 2000, 2001, 2007
		const years = page.locator(".stats .recharts-wrapper").last();
		await expect(years.locator(".recharts-label-list text")).toHaveText(["49", "41", "106", "50", "61", "48"]);
	});
});
