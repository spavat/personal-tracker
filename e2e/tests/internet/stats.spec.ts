import type { Page } from "@playwright/test";

import { expect, resetDb, test } from "../../fixtures";

const currentYear = new Date().getFullYear();

function metric(page: Page, name: string) {
	return page.locator(".headlines .metric").filter({ hasText: name }).locator(".value");
}

// Bar chart labels (Y axis), in duration order
function chartLabels(page: Page, index: number) {
	return page.locator(".stats .recharts-wrapper").nth(index).locator(".recharts-yAxis-tick-labels text");
}

test.describe("Internet - Stats", () => {
	test.afterEach(resetDb);

	test("stats root redirects to the current year", async ({ page }) => {
		await page.goto("/internet/stats");
		await expect(page).toHaveURL(`/internet/stats/${currentYear}`);
		await expect(page.getByRole("heading", { name: `Année ${currentYear}` })).toBeVisible();
	});

	test("2026 shows the programs and tags durations", async ({ page }) => {
		await page.goto("/internet/stats/2026");
		// In progress year: values marked with *
		await expect(metric(page, "Total")).toHaveText("6h 55min*");
		await expect(metric(page, "Programmes / Episodes")).toHaveText("4* / 7*");

		await expect(chartLabels(page, 0)).toHaveText([
			"Tour de France",
			"Mock Podcast",
			"The Great Show",
			"Mock Tube",
		]);
		// Program tags count for every episode, episode tags only for theirs
		await expect(chartLabels(page, 1)).toHaveText(["sport", "science", "tech", "tuto"]);
	});

	test("click a tag shows its programs", async ({ page }) => {
		await page.goto("/internet/stats/2026");
		await page.locator(".stats-music-genre .recharts-bar-rectangle").nth(1).click();
		await expect(page.getByRole("heading", { name: "Tags (science)" })).toBeVisible();
		await expect(chartLabels(page, 2)).toHaveText(["Mock Podcast"]);

		// Click again to unselect
		await page.locator(".stats-music-genre .recharts-bar-rectangle").nth(1).click();
		await expect(page.getByRole("heading", { name: "Tags", exact: true })).toBeVisible();
	});

	test("navigate between years", async ({ page }) => {
		await page.goto("/internet/stats/2026");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page.getByRole("heading", { name: "Année 2025" })).toBeVisible();
		await expect(metric(page, "Programmes / Episodes")).toHaveText("2 / 2");
		await expect(metric(page, "Total")).toHaveText("1h 30min");
		await expect(chartLabels(page, 0)).toHaveText(["Old Show", "Second Podcast"]);
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();
	});
});
