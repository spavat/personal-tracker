import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { mockPodcast, greatShow, oldShow } = SEED.internet;

function reviewRows(page: Page) {
	return page.locator("table.episodesNoTag tbody tr");
}

test.describe("Internet - Review tags", () => {
	test.afterEach(resetDb);

	test("lists the episodes without any tag, most recent first", async ({ page }) => {
		await page.goto("/internet/history");
		await page.getByRole("link", { name: "Review Tag" }).click();
		await expect(page).toHaveURL("/internet/review");

		await expect(page.locator("table.episodesNoTag thead tr")).toHaveAttribute("data-title", "3 épisodes sans tag");
		await expect(reviewRows(page).locator("td:nth-child(5)")).toHaveText(["Episode 2", "Episode 1", "Old episode"]);
		await expect(reviewRows(page).first().getByRole("link", { name: greatShow.name })).toBeVisible();
		await expect(reviewRows(page).last().getByRole("link", { name: oldShow.name })).toBeVisible();
	});

	test("tagging an episode removes it from the list", async ({ page }) => {
		await page.goto("/internet/review");
		await reviewRows(page).filter({ hasText: "Old episode" }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await expect(dialog).toBeVisible();
		// The program has no tag: nothing to ignore
		await expect(dialog.getByText("Ignorer un tag parent")).toHaveCount(0);

		await dialog.getByText("Ajouter un tag").first().click();
		await dialog.locator('input[name="episode.tags.0.value"]').fill("archive");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page).toHaveURL("/internet/review");
		await expect(reviewRows(page).locator("td:nth-child(5)")).toHaveText(["Episode 2", "Episode 1"]);
	});

	test("ignoring the only parent tag puts the episode in the review list", async ({ page }) => {
		await page.goto(`/internet/${mockPodcast.id}`);
		const row = page
			.locator("table.episodes tbody tr")
			.filter({ has: page.getByRole("button", { name: "Modifier" }) })
			.filter({ hasText: "Podcast épisode 0" });
		await row.getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });

		await dialog.getByText("Ignorer un tag parent").click();
		await dialog.locator(".badge", { hasText: "science" }).click();
		const ignored = dialog.locator(".badge-edit", { hasText: "science" });
		await expect(ignored).toHaveCSS("background-color", "rgb(255, 0, 0)");
		// Every parent tag is ignored: nothing left to pick
		await expect(dialog.getByText("Ignorer un tag parent")).toHaveCount(0);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row.locator(".fa-ban")).toBeVisible();
		await expect(row.locator("td").nth(4)).toContainText("science");

		await page.goto("/internet/review");
		const reviewRow = reviewRows(page).filter({ hasText: "Podcast épisode 0" });
		await expect(reviewRow.getByRole("link", { name: mockPodcast.name })).toBeVisible();
		await expect(reviewRow.locator(".fa-ban")).toBeVisible();
	});
});
