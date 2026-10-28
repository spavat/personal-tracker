import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { starFarm } = SEED.game;

function gameRow(page: Page, name: string) {
	return page.locator("table.games tbody tr").filter({ has: page.getByRole("link", { name, exact: true }) });
}

async function openAddModal(page: Page) {
	await page.goto("/game/list");
	await page.getByRole("button", { name: "Ajouter un jeu" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter partie" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Game - Add a play", () => {
	test.afterEach(resetDb);

	test("add a play to an existing game", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("combobox", { name: "Jeu" }).selectOption({ label: starFarm.name });
		await dialog.getByRole("textbox", { name: "Date *" }).fill("2026-10-02");
		await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill("30");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(gameRow(page, starFarm.name).locator("td").nth(6)).toHaveText("02/10/2026");
		await expect(gameRow(page, starFarm.name).locator("td").nth(7)).toHaveText("2");
	});

	test("a play without duration", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("combobox", { name: "Jeu" }).selectOption({ label: starFarm.name });
		await dialog.getByRole("textbox", { name: "Date *" }).fill("2026-10-02");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(gameRow(page, starFarm.name).locator("td").nth(7)).toHaveText("2");
	});

	test("add a play of a new game", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("button", { name: "Créer nouveau" }).click();
		await expect(dialog.getByRole("heading", { name: "Nouveau jeu" })).toBeVisible();
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Sky Tower");
		await dialog.getByRole("textbox", { name: "Developpeur" }).fill("Cloud Dev");
		await dialog.getByRole("textbox", { name: "Editeur" }).fill("Cloud Publishing");
		await dialog.getByRole("textbox", { name: "Date *" }).fill("2026-10-03");
		await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill("40");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(gameRow(page, "Sky Tower").locator("td")).toHaveText([
			"1",
			"",
			"Sky Tower",
			"Cloud Publishing",
			"Cloud Dev",
			"",
			"03/10/2026",
			"1",
			"",
		]);
	});

	test("the add form shows the missing fields", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Choisir un jeu ou en créer un nouveau")).toBeVisible();

		await dialog.getByRole("button", { name: "Créer nouveau" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await expect(dialog.getByText("Le développeur est obligatoire")).toBeVisible();
		await expect(dialog.getByText("L'éditeur est obligatoire")).toBeVisible();
	});
});
