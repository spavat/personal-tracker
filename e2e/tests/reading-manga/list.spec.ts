import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { onePiece, tomie, frieren } = SEED.manga;

function mangaRows(page: Page) {
	return page.locator("table.mangas tbody tr");
}

// Third column holds the manga title
function mangaTitles(page: Page) {
	return mangaRows(page).locator("td:nth-child(3)");
}

async function openAddModal(page: Page) {
	await page.goto("/reading-manga/list");
	await page.getByRole("button", { name: "Ajouter un manga" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter un manga" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Reading Manga - List", () => {
	test.afterEach(resetDb);

	test("list shows the 3 seeded mangas", async ({ page }) => {
		await page.goto("/reading-manga/list");
		await expect(mangaRows(page)).toHaveCount(3);

		const onePieceRow = mangaRows(page).filter({ hasText: onePiece.title });
		await expect(onePieceRow.locator("td")).toHaveText([
			"#2",
			"",
			onePiece.title,
			"Eiichirô ODA",
			"Shonen",
			"",
			"10/05/26",
			"12/05/26",
			"",
		]);

		await expect(mangaRows(page).filter({ hasText: tomie.title }).locator(".fa-circle-check")).toBeVisible();

		const frierenRow = mangaRows(page).filter({ hasText: frieren.title });
		await expect(frierenRow).toContainText("Tsukasa ABE");
		await expect(frierenRow).toContainText("Kanehito YAMADA");
	});

	test("sort by title", async ({ page }) => {
		await page.goto("/reading-manga/list");
		await expect(mangaTitles(page)).toHaveText([frieren.title, onePiece.title, tomie.title]);

		const header = page.getByRole("columnheader", { name: "Titre" });
		await expect(header.locator(".fa-sort-up")).toBeVisible();

		await header.getByText("Titre").click();
		await expect(header.locator(".fa-sort-down")).toBeVisible();
		await expect(mangaTitles(page)).toHaveText([tomie.title, onePiece.title, frieren.title]);

		await header.getByText("Titre").click();
		await expect(header.locator(".fa-sort-up")).toBeVisible();
		await expect(mangaTitles(page)).toHaveText([frieren.title, onePiece.title, tomie.title]);
	});

	test("sort by last reading date", async ({ page }) => {
		await page.goto("/reading-manga/list");
		await page.getByRole("columnheader", { name: "Dernière" }).getByText("Dernière").click();
		await expect(mangaTitles(page)).toHaveText([tomie.title, onePiece.title, frieren.title]);
	});

	test("click a manga opens its details", async ({ page }) => {
		await page.goto("/reading-manga/list");
		await page.getByRole("link", { name: tomie.title }).click();
		await expect(page).toHaveURL(`/reading-manga/manga/${tomie.id}`);
		await expect(page.getByRole("heading", { name: tomie.title })).toBeVisible();
	});

	test("add a new manga", async ({ page }) => {
		const dialog = await openAddModal(page);

		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Dragon Ball");
		await dialog.getByRole("textbox", { name: "Titre anglais" }).fill("Dragon Ball EN");
		await dialog.getByRole("combobox", { name: "Statut lecture" }).selectOption("complete");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption("Seinen");
		// No author yet: a single "+" button adds the first input
		await dialog.locator("label", { hasText: "Mangaka" }).getByRole("button").click();
		await dialog.locator('input[name="manga.author.0.value"]').fill("Akira TORIYAMA");
		await dialog.getByText("Ajouter un genre").click();
		await dialog.locator('input[name="manga.genres.0.value"]').fill("action");
		await dialog.getByRole("button", { name: "Ajouter un lien" }).click();
		await dialog.locator('input[name="manga.links.0.name"]').fill("Wiki");
		await dialog.locator('input[name="manga.links.0.url"]').fill("https://example.com/dragon-ball");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		// Redirected to the page of the new manga
		await expect(page.getByRole("heading", { name: "Dragon Ball", exact: true })).toBeVisible();
		const general = page.locator(".details .general");
		await expect(page.getByText("Dragon Ball EN")).toBeVisible();
		await expect(general).toContainText("Auteur.ic.es: Akira TORIYAMA");
		await expect(general).toContainText("Type : Seinen");
		await expect(general).toContainText("Genres : action");
		await expect(general.getByRole("link", { name: "Wiki" })).toHaveAttribute(
			"href",
			"https://example.com/dragon-ball",
		);

		await page.getByRole("link", { name: "Liste" }).click();
		await expect(mangaRows(page)).toHaveCount(4);
		const row = mangaRows(page).filter({ hasText: "Dragon Ball" });
		await expect(row.locator(".fa-circle-check")).toBeVisible();
		await expect(row.getByRole("link", { name: "Wiki" })).toBeVisible();
	});

	test("manga title is required", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Le titre est obligatoire")).toBeVisible();
		await expect(dialog).toBeVisible();
		await expect(page).toHaveURL("/reading-manga/list");
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(mangaRows(page)).toHaveCount(3);
	});

	test("empty names, empty genres and invalid links show an error", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Invalid Manga");
		// Added but left empty
		await dialog.locator("label", { hasText: "Mangaka" }).getByRole("button").click();
		await dialog.getByText("Ajouter un genre").click();
		await dialog.getByRole("button", { name: "Ajouter un lien" }).click();
		await dialog.locator('input[name="manga.links.0.name"]').fill("Wiki");
		await dialog.locator('input[name="manga.links.0.url"]').fill("not an url");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Un nom ne peut pas être vide")).toBeVisible();
		await expect(dialog.getByText("Un genre ne peut pas être vide")).toBeVisible();
		await expect(dialog.getByText("URL invalide")).toBeVisible();
		await expect(dialog).toBeVisible();
		await expect(page).toHaveURL("/reading-manga/list");
	});

	test("edit a manga from the list", async ({ page }) => {
		await page.goto("/reading-manga/list");
		await mangaRows(page).filter({ hasText: tomie.title }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le manga" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue(tomie.title);
		await expect(dialog.getByRole("combobox", { name: "Type" })).toHaveValue("Seinen");

		await dialog.getByRole("combobox", { name: "Type" }).selectOption("Josei");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page).toHaveURL("/reading-manga/list");
		await expect(mangaRows(page).filter({ hasText: tomie.title }).locator("td").nth(4)).toHaveText("Josei");
	});

	test("cancel the add modal", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Cancelled Manga");
		await dialog.getByRole("button", { name: "Annuler" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(mangaRows(page)).toHaveCount(3);
	});
});
