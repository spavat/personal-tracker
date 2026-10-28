import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { artists, spectacles } = SEED.show;

function artistRows(page: Page) {
	return page.locator("table.artists tbody tr");
}

function artistNames(page: Page) {
	return artistRows(page).locator("td:nth-child(2)");
}

function artistRow(page: Page, name: string) {
	return artistRows(page).filter({ hasText: name });
}

function performanceRows(page: Page) {
	// Group title rows have a single cell
	return page.locator("table.performancesWithRole tbody tr").filter({ has: page.locator("td:nth-child(2)") });
}

async function openArtist(page: Page, artist: { id: number; name: string }) {
	await page.goto(`/shows/artists/${artist.id}`);
	await expect(page.getByRole("heading", { name: artist.name })).toBeVisible();
}

test.describe("Shows - Artists", () => {
	test.afterEach(resetDb);

	test("list shows the artists sorted by name", async ({ page }) => {
		await page.goto("/shows/artists");
		await expect(artistNames(page)).toHaveText([artists.alice.name, artists.bob.name, artists.claire.name]);
		await expect(artistRow(page, artists.bob.name).locator("td")).toHaveText([
			"#2",
			artists.bob.name,
			"2",
			"2",
			" ",
		]);
	});

	test("sort the list", async ({ page }) => {
		await page.goto("/shows/artists");
		const header = page.getByRole("columnheader", { name: "Spectacle(s)" });
		await header.getByText("Spectacle(s)").click();
		await expect(header.locator(".fa-sort-up")).toBeVisible();
		await expect(artistNames(page)).toHaveText([artists.claire.name, artists.alice.name, artists.bob.name]);

		await header.getByText("Spectacle(s)").click();
		await expect(artistNames(page)).toHaveText([artists.bob.name, artists.alice.name, artists.claire.name]);

		// Stored: same sort after a reload
		await page.reload();
		await expect(artistNames(page)).toHaveText([artists.bob.name, artists.alice.name, artists.claire.name]);
	});

	test("an artist with performances can't be deleted", async ({ page }) => {
		await page.goto("/shows/artists");
		await expect(artistRow(page, artists.alice.name).getByRole("button", { name: "Supprimer" })).toBeDisabled();
		await expect(artistRow(page, artists.bob.name).getByRole("button", { name: "Supprimer" })).toBeDisabled();
		await expect(artistRow(page, artists.claire.name).getByRole("button", { name: "Supprimer" })).toBeEnabled();
	});

	test("delete an artist", async ({ page }) => {
		await page.goto("/shows/artists");
		await artistRow(page, artists.claire.name).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer artiste" });
		await expect(dialog).toContainText(`Nom : ${artists.claire.name}`);

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(artistRows(page)).toHaveCount(3);

		await artistRow(page, artists.claire.name).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(artistNames(page)).toHaveText([artists.alice.name, artists.bob.name]);
	});

	test("add an artist", async ({ page }) => {
		await page.goto("/shows/artists");
		await page.getByRole("button", { name: "Ajouter un artiste" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un artiste" });
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Bernard Durand");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(artistNames(page)).toHaveText([
			artists.alice.name,
			"Bernard Durand",
			artists.bob.name,
			artists.claire.name,
		]);
	});

	test("edit an artist from the list", async ({ page }) => {
		await page.goto("/shows/artists");
		await artistRow(page, artists.bob.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'artiste" });
		await expect(dialog.getByRole("textbox", { name: "Nom *" })).toHaveValue(artists.bob.name);
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Robert Smith");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(artistNames(page)).toHaveText([artists.alice.name, artists.claire.name, "Robert Smith"]);
	});

	test("details page shows the artist performances", async ({ page }) => {
		await openArtist(page, artists.bob);
		const stats = page.locator(".presentation .stats");
		await expect(stats).toContainText("2 spectacles");
		await expect(stats).toContainText("2 représentations");
		await expect(stats).toContainText("(08/11/25)");

		await expect(performanceRows(page).locator("td:nth-child(3)")).toHaveText([
			spectacles.miserablesParis.name,
			spectacles.miserablesLondres.name,
		]);
		await expect(performanceRows(page).locator("td:nth-child(4)")).toHaveText(["Javert", "Javert"]);

		await page.getByRole("checkbox", { name: "Grouper par spectacle" }).check();
		await expect(page.locator("table.performancesWithRole .title")).toHaveText([
			spectacles.miserablesParis.name,
			spectacles.miserablesLondres.name,
		]);

		await performanceRows(page).first().getByRole("link", { name: spectacles.miserablesParis.name }).click();
		await expect(page).toHaveURL(`/shows/spectacles/${spectacles.miserablesParis.id}`);
	});

	test("details page of an artist without performance", async ({ page }) => {
		await openArtist(page, artists.claire);
		const stats = page.locator(".presentation .stats");
		await expect(stats).toContainText("0 spectacle");
		await expect(stats).toContainText("Dernière fois : Aucune");
		await expect(performanceRows(page)).toHaveCount(0);
	});

	test("edit an artist from its page", async ({ page }) => {
		await openArtist(page, artists.alice);
		await page.locator(".presentation").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'artiste" });
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Alice Martin-Leroy");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Alice Martin-Leroy" })).toBeVisible();
	});

	test("the artist name is required", async ({ page }) => {
		await page.goto("/shows/artists");
		await page.getByRole("button", { name: "Ajouter un artiste" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un artiste" });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(artistRows(page)).toHaveCount(3);
	});
});
