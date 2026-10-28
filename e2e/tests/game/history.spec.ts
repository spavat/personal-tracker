import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { hollow, starFarm, ruins } = SEED.game;

const currentYear = new Date().getFullYear();

function monthTitles(page: Page) {
	return page.locator(".module h2");
}

function card(page: Page, name: string) {
	return page.locator(".card_item").filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Game - History", () => {
	test.afterEach(resetDb);

	test("game root goes to the current year", async ({ page }) => {
		await page.goto("/game");
		await expect(page).toHaveURL(`/game/history/${currentYear}`);
	});

	test("games are grouped by month of their last play", async ({ page }) => {
		await page.goto("/game/history/2026");
		await expect(monthTitles(page)).toHaveText(["août 2026 (1)", "mai 2026 (1)"]);
		// Duration played this year
		await expect(card(page, hollow.name)).toContainText("📅 15/08/2026 ⏱️ 2h 15min");
		await card(page, hollow.name).getByText("Détails de jeu (2)").click();
		await expect(card(page, hollow.name).locator("li")).toHaveCount(2);
		// No duration
		await expect(card(page, starFarm.name)).toContainText("⏱️ 0min");
	});

	test("navigate between years", async ({ page }) => {
		await page.goto("/game/history/2026");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page).toHaveURL("/game/history/2025");
		await expect(monthTitles(page)).toHaveText(["décembre 2025 (1)", "juillet 2025 (1)"]);
		await expect(card(page, ruins.name)).toContainText("⏱️ 1h");

		await page.goto(`/game/history/${currentYear}`);
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
	});

	test("add a play from the history", async ({ page }) => {
		await page.goto("/game/history/2026");
		await page.getByRole("button", { name: "Ajouter une partie" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter partie" });
		await dialog.getByRole("combobox", { name: "Jeu" }).selectOption({ label: ruins.name });
		await dialog.getByRole("textbox", { name: "Date *" }).fill("2026-10-05");
		await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill("20");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(monthTitles(page).first()).toHaveText("octobre 2026 (1)");
		await expect(card(page, ruins.name)).toContainText("⏱️ 20min");
	});
});
