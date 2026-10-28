import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { rock, electronic } = SEED.music.genres;

function genreRows(page: Page) {
	return page.locator("table.list tbody tr");
}

function genreRow(page: Page, name: string) {
	return genreRows(page).filter({ has: page.getByRole("cell", { name, exact: true }) });
}

test.describe("Music - Genres", () => {
	test.afterEach(resetDb);

	test("list shows the main genres", async ({ page }) => {
		await page.goto("/music/genres");
		await expect(genreRows(page).locator("td:first-child")).toHaveText([rock.name, electronic.name]);
		await expect(genreRow(page, rock.name).locator(".badge")).toHaveText(["Rock", "Grunge", "Hard Rock"]);
	});

	test("add a main genre", async ({ page }) => {
		await page.goto("/music/genres");
		await page.getByRole("button", { name: "Ajouter un genre principal" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un genre principal" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Cinéma");
		await dialog.locator('input[name="genres.0.value"]').fill("Soundtrack");
		await dialog.getByRole("button", { name: "Ajouter" }).click();
		await dialog.locator('input[name="genres.1.value"]').fill("Score");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(genreRow(page, "Cinéma").locator(".badge")).toHaveText(["Soundtrack", "Score"]);
	});

	test("the main genre name is required", async ({ page }) => {
		await page.goto("/music/genres");
		await page.getByRole("button", { name: "Ajouter un genre principal" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un genre principal" });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
	});

	test("edit a main genre", async ({ page }) => {
		await page.goto("/music/genres");
		await genreRow(page, rock.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le genre principal" });
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue(rock.name);

		await dialog.getByRole("textbox", { name: "Nom" }).fill("Rock & co");
		// Remove Grunge
		await dialog.locator(".full-fields-row").nth(1).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(genreRow(page, "Rock & co").locator(".badge")).toHaveText(["Rock", "Hard Rock"]);

		// Grunge is now a genre on its own in the stats
		await page.goto("/music/stats/2026");
		await expect(
			page.locator(".stats-music-genre .recharts-wrapper").first().locator(".recharts-yAxis-tick-labels text"),
		).toHaveText(["Rock & co", "Electronic", "Grunge", "Soundtrack"]);
	});

	test("delete a main genre", async ({ page }) => {
		await page.goto("/music/genres");
		await genreRow(page, electronic.name).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer le genre principal" });
		await expect(dialog).toContainText(electronic.name);

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(genreRows(page)).toHaveCount(2);

		await genreRow(page, electronic.name).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(genreRows(page).locator("td:first-child")).toHaveText([rock.name]);
	});
});
