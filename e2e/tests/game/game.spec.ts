import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { hollow, starFarm } = SEED.game;

function playRows(page: Page) {
	return page.locator("table.plays tbody tr");
}

async function openGame(page: Page, game: { id: string; name: string }) {
	await page.goto(`/game/details/${game.id}`);
	await expect(page.getByRole("heading", { name: game.name })).toBeVisible();
}

async function openEditGame(page: Page, game: { id: string; name: string }) {
	await openGame(page, game);
	await page.locator(".presentation").getByRole("button", { name: "Modifier" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier le jeu" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Game - Game details", () => {
	test.afterEach(resetDb);

	test("details page shows the game and its plays", async ({ page }) => {
		await openGame(page, hollow);
		const general = page.locator(".presentation .general");
		await expect(general).toContainText("Dev: Cherry Team");
		await expect(general).toContainText("Editeur : Cherry Publishing");
		await expect(general).toContainText("Statut : Terminé");
		await expect(general.getByRole("link", { name: "Steam" })).toBeVisible();

		await expect(playRows(page).locator("td:nth-child(3)")).toHaveText(["15/08/2026", "03/02/2026", "20/12/2025"]);
		await expect(playRows(page).locator("td:nth-child(4)")).toHaveText(["45min", "1h 30min", "2h"]);
		await expect(playRows(page).nth(1).locator("td").nth(4)).toHaveText("Boss final");
	});

	test("edit a game", async ({ page }) => {
		const dialog = await openEditGame(page, starFarm);
		await dialog.getByRole("textbox", { name: "Editeur" }).fill("Farm Publishing");
		await dialog.getByRole("checkbox", { name: "Terminé" }).check();
		await dialog.getByRole("button", { name: "Ajouter un lien" }).click();
		await dialog.locator('input[name="game.links.0.name"]').fill("Site");
		await dialog.locator('input[name="game.links.0.link"]').fill("https://starfarm.example.com");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		const general = page.locator(".presentation .general");
		await expect(general).toContainText("Editeur : Farm Publishing");
		await expect(general).toContainText("Statut : Terminé");
		await expect(general.getByRole("link", { name: "Site" })).toHaveAttribute(
			"href",
			"https://starfarm.example.com",
		);
	});

	test("remove the links of a game", async ({ page }) => {
		const dialog = await openEditGame(page, hollow);
		await dialog.locator(".full-fields-row").getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.locator(".presentation .general")).not.toContainText("Liens:");
		await page.reload();
		await expect(page.locator(".presentation .general")).not.toContainText("Liens:");
	});

	test("the game form shows the missing fields", async ({ page }) => {
		const dialog = await openEditGame(page, starFarm);
		await dialog.getByRole("textbox", { name: "Developpeur" }).fill("");
		await dialog.getByRole("textbox", { name: "Editeur" }).fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le développeur est obligatoire")).toBeVisible();
		await expect(dialog.getByText("L'éditeur est obligatoire")).toBeVisible();
	});

	test("add a play to the game", async ({ page }) => {
		await openGame(page, starFarm);
		await page.getByRole("button", { name: "Ajouter une partie" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter partie" });
		await expect(dialog.getByRole("combobox", { name: "Jeu" })).toHaveValue(starFarm.id);
		await dialog.getByRole("textbox", { name: "Date *" }).fill("2026-10-01");
		await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill("75");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(playRows(page)).toHaveCount(2);
		await expect(playRows(page).first().locator("td").nth(3)).toHaveText("1h 15min");
	});

	test("edit a play", async ({ page }) => {
		await openGame(page, hollow);
		await playRows(page).first().getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier la partie" });
		await expect(dialog.getByRole("spinbutton", { name: "Durée (min)" })).toHaveValue("45");
		await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill("50");
		await dialog.getByRole("textbox", { name: "Commentaire" }).fill("DLC");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(playRows(page).first().locator("td").nth(3)).toHaveText("50min");
		await expect(playRows(page).first().locator("td").nth(4)).toHaveText("DLC");
	});

	test("delete a play", async ({ page }) => {
		await openGame(page, hollow);
		await playRows(page).nth(1).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer partie" });
		await expect(dialog).toContainText("Durée : 1h 30min");

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(playRows(page)).toHaveCount(3);

		await playRows(page).nth(1).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(playRows(page).locator("td:nth-child(3)")).toHaveText(["15/08/2026", "20/12/2025"]);
	});
});
