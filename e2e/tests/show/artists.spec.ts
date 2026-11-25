import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { artists, spectacles } = SEED.show;

// Served by e2e/mocks/fetch-mock.mjs
const PORTRAIT_URL = "https://images.example.com/book-cover.svg";

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

// cards are the default display: the table is one select away
async function openList(page: Page) {
	await page.goto("/shows/artists");
	await page.getByLabel("Affichage").selectOption("list");
}

async function openArtist(page: Page, artist: { id: string; name: string }) {
	await page.goto(`/shows/artists/${artist.id}`);
	await expect(page.getByRole("heading", { name: artist.name })).toBeVisible();
}

test.describe("Shows - Artists", () => {
	test.afterEach(resetDb);

	// the people credited in a role: Claire has none
	test("list shows the artists as cards, then as a table", async ({ page }) => {
		await page.goto("/shows/artists");
		await expect(page.locator(".card_item.artist .title")).toHaveText([artists.alice.name, artists.bob.name]);
		await expect(artistRows(page)).toHaveCount(0);

		await page.getByLabel("Affichage").selectOption("list");
		await expect(artistNames(page)).toHaveText([artists.alice.name, artists.bob.name]);
		await expect(artistRow(page, artists.bob.name).locator("td")).toHaveText(["2", artists.bob.name, "2", "2", ""]);
		// created from the casting and model forms, never deleted from here
		await expect(page.getByRole("button", { name: "Ajouter un artiste" })).toHaveCount(0);
		await expect(artistRow(page, artists.bob.name).getByRole("button", { name: "Supprimer" })).toHaveCount(0);
	});

	test("sort the list", async ({ page }) => {
		await openList(page);
		const header = page.getByRole("columnheader", { name: "Spectacle(s)" });
		await header.getByText("Spectacle(s)").click();
		await expect(header.locator(".fa-sort-up")).toBeVisible();
		await expect(artistNames(page)).toHaveText([artists.alice.name, artists.bob.name]);

		await header.getByText("Spectacle(s)").click();
		await expect(artistNames(page)).toHaveText([artists.bob.name, artists.alice.name]);

		// Stored: same sort after a reload
		await page.reload();
		await expect(artistNames(page)).toHaveText([artists.bob.name, artists.alice.name]);
	});

	test("edit an artist from the list", async ({ page }) => {
		await openList(page);
		await artistRow(page, artists.bob.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'artiste" });
		await expect(dialog.getByRole("textbox", { name: "Nom *" })).toHaveValue(artists.bob.name);
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Robert Smith");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(artistNames(page)).toHaveText([artists.alice.name, "Robert Smith"]);
	});

	test("details page shows the artist performances", async ({ page }) => {
		await openArtist(page, artists.bob);
		const stats = page.locator(".presentation-with-picture .general");
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
		const stats = page.locator(".presentation-with-picture .general");
		await expect(stats).toContainText("0 spectacle");
		await expect(stats).toContainText("Dernière fois : Aucune");
		await expect(performanceRows(page)).toHaveCount(0);
	});

	test("edit an artist from its page", async ({ page }) => {
		await openArtist(page, artists.alice);
		await page.locator(".presentation-with-picture").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'artiste" });
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Alice Martin-Leroy");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Alice Martin-Leroy" })).toBeVisible();
	});

	test("the artist name is required", async ({ page }) => {
		await openList(page);
		await artistRow(page, artists.bob.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'artiste" });
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(artistNames(page)).toHaveText([artists.alice.name, artists.bob.name]);
	});

	test("add a portrait from a URL, then remove it", async ({ page }) => {
		await openArtist(page, artists.alice);
		const editButton = page.locator(".presentation-with-picture").getByRole("button", { name: "Modifier" });
		await editButton.click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'artiste" });
		await dialog.getByRole("textbox", { name: "URL de l'image" }).fill(PORTRAIT_URL);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		// the entity's portrait, served by the images proxy
		const portrait = page.getByRole("img", { name: artists.alice.name });
		await expect(portrait).toHaveAttribute("src", /\/images\/entity\/[0-9a-f-]+\?v=[0-9a-f]+$/);
		await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

		await editButton.click();
		await expect(dialog.getByRole("img", { name: "Portrait" })).toBeVisible();
		await dialog.getByRole("button", { name: "Retirer le portrait" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(portrait).toHaveCount(0);
	});
});
