import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { track, footing, swim, bike } = SEED.sport;

const currentMonth = new Date().toISOString().slice(0, 7);

function cardNames(page: Page) {
	return page.locator(".card_item .title");
}

function card(page: Page, name: string) {
	return page.locator(".card_item").filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Sport - History", () => {
	test.afterEach(resetDb);

	test("sport root goes to the current month", async ({ page }) => {
		await page.goto("/sport");
		await expect(page).toHaveURL(`/sport/history/${currentMonth}`);
	});

	test("cards show the activities of the month", async ({ page }) => {
		await page.goto("/sport/history/2026-10");
		await expect(cardNames(page)).toHaveText([track.name, footing.name, swim.name]);
		await expect(card(page, footing.name)).toContainText("Course à pied");
		await expect(card(page, footing.name).locator(".activity-stats")).toHaveText(
			"📅 11/10/2026 📏 10.2 km ⏱️ 55min 🏃 5:23 /km",
		);
		// No GPX file, so no thumbnail
		await expect(card(page, footing.name).locator("img")).toHaveCount(0);
	});

	test("an activity on the last day of the month is listed", async ({ page }) => {
		await page.goto("/sport/history/2026-09");
		await expect(cardNames(page)).toHaveText([bike.name]);
		await expect(card(page, bike.name).locator(".activity-stats")).toContainText("⏱️ 2h 15min");
	});

	test("navigate between months", async ({ page }) => {
		await page.goto("/sport/history/2026-10");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page).toHaveURL("/sport/history/2026-09");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page).toHaveURL("/sport/history/2026-08");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page.getByText("Aucune activité ce mois-ci.")).toBeVisible();

		await page.goto(`/sport/history/${currentMonth}`);
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
		await page.goto("/sport/history/2018-01");
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();
	});

	test("a card opens the activity", async ({ page }) => {
		await page.goto("/sport/history/2026-10");
		await page.getByRole("link", { name: footing.name }).click();
		await expect(page).toHaveURL(`/sport/${footing.id}`);
	});

	test("add an activity from the history", async ({ page }) => {
		await page.goto("/sport/history/2026-10");
		await page.getByRole("button", { name: "Ajouter une activité" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter activité" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Vélotaf");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption({ label: "Cyclisme" });
		await dialog.getByLabel("Date").fill("2026-10-26T08:15");
		await dialog.getByRole("spinbutton", { name: "Distance (km)" }).fill("8.5");
		await dialog.getByRole("spinbutton", { name: "Temps total (min)" }).fill("30");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(cardNames(page).first()).toHaveText("Vélotaf");
		await expect(card(page, "Vélotaf")).toContainText("Cyclisme");
	});
});
