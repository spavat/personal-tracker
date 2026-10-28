import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { hollow, starFarm, ruins } = SEED.game;

function gameRows(page: Page) {
	return page.locator("table.games tbody tr");
}

function gameNames(page: Page) {
	return gameRows(page).locator("td:nth-child(3)");
}

function gameRow(page: Page, name: string) {
	return gameRows(page).filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Game - List", () => {
	test.afterEach(resetDb);

	test("list shows the games, last played first", async ({ page }) => {
		await page.goto("/game/list");
		await expect(gameNames(page)).toHaveText([hollow.name, starFarm.name, ruins.name]);
		await expect(gameRow(page, hollow.name).locator("td")).toHaveText([
			"1",
			"",
			hollow.name,
			"Cherry Publishing",
			"Cherry Team",
			"Steam",
			"15/08/2026",
			"3",
			"",
		]);
		await expect(gameRow(page, hollow.name).locator(".complete-color")).toBeVisible();
		await expect(gameRow(page, starFarm.name).locator(".complete-color")).toHaveCount(0);
		await expect(gameRow(page, hollow.name).getByRole("link", { name: "Steam" })).toHaveAttribute(
			"href",
			"https://store.steampowered.com/app/1001/",
		);
	});

	test("sort the list by name", async ({ page }) => {
		await page.goto("/game/list");
		const header = page.getByRole("columnheader", { name: "Jeu" });
		await header.getByText("Jeu").click();
		await expect(gameNames(page)).toHaveText([hollow.name, ruins.name, starFarm.name]);
		await header.getByText("Jeu").click();
		await expect(gameNames(page)).toHaveText([starFarm.name, ruins.name, hollow.name]);
	});

	test("a game name opens its details", async ({ page }) => {
		await page.goto("/game/list");
		await page.getByRole("link", { name: ruins.name }).click();
		await expect(page).toHaveURL(`/game/details/${ruins.id}`);
		await expect(page.getByRole("heading", { name: ruins.name })).toBeVisible();
	});

	test("edit a game from the list", async ({ page }) => {
		await page.goto("/game/list");
		await gameRow(page, ruins.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le jeu" });
		await expect(dialog.getByRole("textbox", { name: "Editeur" })).toHaveValue("Indie Publishing");
		await dialog.getByRole("checkbox", { name: "Terminé" }).check();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(gameRow(page, ruins.name).locator(".complete-color")).toBeVisible();
	});

	test("search a game with ctrl+shift+f", async ({ page }) => {
		await page.goto("/game/list");
		await expect(gameRows(page)).toHaveCount(3);
		await page.keyboard.press("Control+Shift+F");
		const search = page.getByPlaceholder("Recherche");
		await expect(search).toBeFocused();
		await search.fill("star");
		await expect(page.locator(".search .result-item")).toHaveCount(1);
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(`/game/details/${starFarm.id}`);
	});
});
