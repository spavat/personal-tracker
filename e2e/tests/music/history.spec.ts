import type { Page } from "@playwright/test";

import { expect, resetDb, test } from "../../fixtures";

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function dayCards(page: Page) {
	return page.locator(".grid .card_item");
}

test.describe("Music - History", () => {
	test.afterEach(resetDb);

	test("music root and history root go to the current month", async ({ page }) => {
		await page.goto("/music");
		await expect(page).toHaveURL(`/music/history/${currentMonth}`);
		await page.goto("/music/history");
		await expect(page).toHaveURL(`/music/history/${currentMonth}`);
	});

	test("one card per day", async ({ page }) => {
		await page.goto("/music/history/2026-09");
		await expect(dayCards(page).locator("h3")).toHaveText(["lundi 14", "mercredi 2", "mardi 1"]);
		await expect(dayCards(page).first()).toContainText("#1 Justice, Mehdi - Cross - 2007");
		await expect(dayCards(page).first()).toContainText("#2 Various Artists - Pulp Fiction OST - 1994");
		await expect(dayCards(page).nth(2)).toContainText("#4 Radiohead - OK Computer - 1997");
	});

	test("an empty month", async ({ page }) => {
		await page.goto("/music/history/2026-08");
		await expect(page.getByText("Aucune écoute ce mois-ci.")).toBeVisible();
		await expect(dayCards(page)).toHaveCount(0);
	});

	test("navigate between months", async ({ page }) => {
		await page.goto("/music/history/2026-10");
		await expect(dayCards(page)).toHaveCount(2);
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page).toHaveURL("/music/history/2026-09");
		await expect(dayCards(page)).toHaveCount(3);
		await page.getByRole("button", { name: "Go to next" }).click();
		await expect(page).toHaveURL("/music/history/2026-10");
	});

	test("add a listening from the history", async ({ page }) => {
		await page.goto("/music/history/2026-10");
		await page.getByRole("button", { name: "Ajouter une écoute" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une écoute" });
		await dialog.locator('input[name="artist.0.value"]').fill("Björk");
		await dialog.getByRole("textbox", { name: "Album" }).fill("Homogenic");
		await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill("44");
		await dialog.getByLabel("Date d'écoute").fill("2026-10-05");
		await dialog.getByRole("textbox", { name: "Date (ou année) de release" }).fill("1997");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(dayCards(page).nth(1)).toContainText("#3 Björk - Homogenic - 1997");
		await expect(dayCards(page).nth(1)).toContainText("#4 Nirvana - Nevermind - 1991");
	});
});
