import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { track } = SEED.sport;

async function openCrop(page: Page) {
	await page.goto(`/sport/${track.id}`);
	await page.getByRole("button", { name: "Rogner le tracé" }).click();
	await expect(page).toHaveURL(`/sport/${track.id}/crop`);
	await expect(page.getByRole("heading", { name: `Rogner le tracé — ${track.name}` })).toBeVisible();
}

test.describe("Sport - Crop", () => {
	test.afterEach(resetDb);

	test("crop the start and the end of the track", async ({ page }) => {
		await openCrop(page);
		const start = page.getByRole("slider", { name: /Début/ });
		const end = page.getByRole("slider", { name: /Fin/ });
		await expect(page.getByText("Début : point 1 / 25")).toBeVisible();
		await expect(page.getByText("Fin : point 25 / 25")).toBeVisible();

		await start.press("ArrowRight");
		await start.press("ArrowRight");
		for (let i = 0; i < 4; i++) await end.press("ArrowLeft");
		await expect(page.getByText("Début : point 3 / 25")).toBeVisible();
		await expect(page.getByText("Fin : point 21 / 25")).toBeVisible();
		await page.getByRole("button", { name: "Enregistrer" }).click();

		// 18 intervals of 100 m and 30 s
		await expect(page).toHaveURL(`/sport/${track.id}`);
		const general = page.locator(".presentation .general");
		await expect(general).toContainText("Distance : 1.8 km");
		await expect(general).toContainText("Temps : 9min (en mouvement 9min)");
		await expect(general).toContainText("Dénivelé positif : 18 m");
		await expect(page.locator("table.list").first().locator("tbody tr")).toHaveText([
			"15:00/km",
			"2 (800 m)5:00/km",
		]);
		// The segments are moved by the 1 min cropped at the start
		await expect(
			page
				.getByRole("table")
				.filter({ has: page.getByRole("columnheader", { name: "Temps" }) })
				.locator("tbody tr td:nth-child(1)"),
		).toHaveText(["0:00", "4:00", "5:00"]);

		await page.goto("/sport/list");
		await expect(page.getByRole("row", { name: new RegExp(track.name) })).toContainText("1.8 km");
	});

	test("the start can't go past the end", async ({ page }) => {
		await openCrop(page);
		const start = page.getByRole("slider", { name: /Début/ });
		await start.press("End");
		await expect(page.getByText("Début : point 24 / 25")).toBeVisible();
	});

	test("cancel the crop", async ({ page }) => {
		await openCrop(page);
		await page.getByRole("slider", { name: /Début/ }).press("ArrowRight");
		await page.getByRole("button", { name: "Annuler" }).click();

		await expect(page).toHaveURL(`/sport/${track.id}`);
		await expect(page.locator(".presentation .general")).toContainText("Distance : 2.4 km");
		await expect(page.locator("table.list").first().locator("tbody tr")).toHaveCount(3);
	});
});
