import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { onePiece, frieren } = SEED.manga;

function readingRows(page: Page) {
	return page.locator("table.readings tbody tr");
}

async function openEditModal(page: Page, manga: { id: string; title: string }) {
	await page.goto(`/reading-manga/manga/${manga.id}`);
	await page.getByRole("button", { name: "Modifier le manga" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier le manga" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Reading Manga - Details", () => {
	test.afterEach(resetDb);

	test("details page shows art, scenario and genres", async ({ page }) => {
		await page.goto(`/reading-manga/manga/${frieren.id}`);
		await expect(page.getByRole("heading", { name: frieren.title })).toBeVisible();

		const general = page.locator(".details .general");
		await expect(general).toContainText("Dessin: Tsukasa ABE");
		await expect(general).toContainText("Scenario: Kanehito YAMADA");
		await expect(general).toContainText("Type : Shonen");
		await expect(general).toContainText("Genres : aventure, fantastique");
		await expect(general).not.toContainText("Auteur.ic.es");
		await expect(readingRows(page)).toHaveCount(1);
	});

	test("details page shows the readings, newest first", async ({ page }) => {
		await page.goto(`/reading-manga/manga/${onePiece.id}`);
		await expect(page.locator(".details .general")).toContainText("Auteur.ic.es: Eiichirô ODA");

		await expect(readingRows(page)).toHaveCount(6);
		await expect(readingRows(page).locator("td:nth-child(4)")).toHaveText([
			"T06",
			"T05",
			"T04",
			"T03",
			"T02",
			"T01",
		]);
		await expect(readingRows(page).first().locator("td")).toHaveText([
			"#1",
			"mar.",
			"12/05/26",
			"T06",
			"",
			"fr",
			"Digital",
			"",
		]);
	});

	test("edit the manga", async ({ page }) => {
		const dialog = await openEditModal(page, frieren);
		await expect(dialog.getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue(frieren.title);
		await expect(dialog.locator('input[name="manga.art.0.value"]')).toHaveValue("Tsukasa ABE");
		await expect(dialog.locator('input[name="manga.genres.1.value"]')).toHaveValue("fantastique");

		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Sousou no Frieren");
		await dialog.getByRole("textbox", { name: "Titre anglais" }).fill("Frieren: Beyond Journey's End");
		// Remove the "aventure" genre
		await dialog.locator(".badge-edit").first().getByText("✕").click();
		// No author yet: a single "+" button adds the first input
		await dialog.locator("label", { hasText: "Mangaka" }).getByRole("button").click();
		await dialog.locator('input[name="manga.author.0.value"]').fill("Someone");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Sousou no Frieren" })).toBeVisible();
		await expect(page.getByText("Frieren: Beyond Journey's End")).toBeVisible();
		const general = page.locator(".details .general");
		await expect(general).toContainText("Auteur.ic.es: Someone");
		await expect(general).toContainText("Genres : fantastique");
		await expect(general).toContainText("Dessin: Tsukasa ABE");
	});

	test("cancel the edit", async ({ page }) => {
		const dialog = await openEditModal(page, frieren);
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Should not be saved");
		await dialog.getByRole("button", { name: "Annuler" }).click();

		await expect(dialog).not.toBeVisible();
		await page.reload();
		await expect(page.getByRole("heading", { name: frieren.title })).toBeVisible();
	});

	test("search a manga with ctrl+shift+f", async ({ page }) => {
		await page.goto(`/reading-manga/manga/${onePiece.id}`);
		await expect(page.getByRole("heading", { name: onePiece.title })).toBeVisible();

		await page.keyboard.press("Control+Shift+F");
		const search = page.getByPlaceholder("Recherche");
		await expect(search).toBeFocused();
		await search.fill("frie");
		await expect(page.locator(".search .result-item")).toHaveCount(1);
		await page.keyboard.press("Enter");

		await expect(page).toHaveURL(`/reading-manga/manga/${frieren.id}`);
		await expect(page.getByRole("heading", { name: frieren.title })).toBeVisible();
	});
});
