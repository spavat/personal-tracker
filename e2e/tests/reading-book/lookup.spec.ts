import type { Page } from "@playwright/test";

import { expect, pickEntity, queryDb, resetDb, SEED, test } from "../../fixtures";

const { alice } = SEED.book;

// Open Library is served by e2e/mocks/fetch-mock.mjs: any search answers "Through the Looking-Glass" (Lewis
// Carroll, a seeded person, and John Tenniel, unknown) then "The Hunting of the Snark"; ISBN 9782070388523 is
// its Folio edition. Its work (OL102749W) has 3 editions: Folio (French), Macmillan (English), an ebook without language.
test.describe("Reading Book - Open Library lookup", () => {
	test.afterEach(resetDb);

	async function openAddBook(page: Page) {
		await page.goto("/reading-book/list");
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await expect(dialog).toBeVisible();
		return dialog;
	}

	test("search by title, pick a result: the form is filled in", async ({ page }) => {
		const dialog = await openAddBook(page);

		await dialog.getByRole("textbox", { name: "Titre ou ISBN" }).fill("looking glass");
		await dialog.getByRole("textbox", { name: "Auteur (facultatif)" }).fill("carroll");
		// Enter searches, it doesn't submit the book form
		await dialog.getByRole("textbox", { name: "Auteur (facultatif)" }).press("Enter");
		await expect(dialog.getByRole("button", { name: "Choisir The Hunting of the Snark" })).toBeVisible();
		await dialog.getByRole("button", { name: "Choisir Through the Looking-Glass" }).click();

		await expect(dialog.getByText("Rempli depuis Open Library : Through the Looking-Glass")).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue("Through the Looking-Glass");
		await expect(dialog.getByRole("spinbutton", { name: "Année de publication" })).toHaveValue("1871");
		// matched to the seeded person
		await expect(dialog.getByRole("textbox", { name: "Auteur·ice 1", exact: true })).toHaveValue("Lewis Carroll");
		// unknown: an empty picker looking for that name
		const second = dialog.getByRole("textbox", { name: "Auteur·ice 2", exact: true });
		await expect(second).toHaveValue("");
		await expect(second).toHaveAttribute("placeholder", "John Tenniel");
		await second.focus();
		await expect(second).toHaveValue("John Tenniel");
		await expect(page.locator(".search-select-item.create")).toHaveText(/Créer la personne « John Tenniel »/);
		await pickEntity(dialog, "Auteur·ice 2", "John Tenniel");

		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(page.getByRole("heading", { name: "Through the Looking-Glass", level: 2 })).toBeVisible();
		await expect(page.getByText("Auteur·ice: Lewis Carroll, John Tenniel")).toBeVisible();
		await expect(page.getByText("Année de publication : 1871")).toBeVisible();
		const [{ external_id }] = await queryDb(
			`SELECT x.external_id FROM core.external_id x JOIN reading.book b ON b.id = x.node_id
			 WHERE b.title = 'Through the Looking-Glass' AND x.source = 'openLibrary'`,
		);
		expect(external_id).toBe("OL102749W");
	});

	test("search by ISBN: saving the book opens its first edition", async ({ page }) => {
		const dialog = await openAddBook(page);

		await dialog.getByRole("textbox", { name: "Titre ou ISBN" }).fill("978-2-07-038852-3");
		// an ISBN search ignores the author
		await expect(dialog.getByRole("textbox", { name: "Auteur (facultatif)" })).toBeDisabled();
		await dialog.getByRole("button", { name: "Rechercher" }).click();
		await dialog.getByRole("button", { name: "Choisir Through the Looking-Glass" }).click();
		// focused, the picker holds the name to look for: picked once it is there
		const second = dialog.getByRole("textbox", { name: "Auteur·ice 2", exact: true });
		await second.focus();
		await expect(second).toHaveValue("John Tenniel");
		await pickEntity(dialog, "Auteur·ice 2", "John Tenniel");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		const editionDialog = page.getByRole("dialog", { name: "Modifier l'édition" });
		await expect(editionDialog).toBeVisible();
		// TanStack Router quotes a string of digits (isbn=%22…%22) to read it back as a string
		await expect(page).toHaveURL(/\/edition\/[0-9a-f-]+\/edit\?.*isbn=(%22)?9782070388523/);

		// the edition of that ISBN fills the form
		await expect(editionDialog.getByText("Rempli depuis Open Library : De l'autre côté du miroir")).toBeVisible();
		await expect(editionDialog.getByRole("textbox", { name: "Titre de l'édition" })).toHaveValue(
			"De l'autre côté du miroir",
		);
		await expect(editionDialog.getByRole("textbox", { name: "Langue", exact: true })).toHaveValue("fr");
		await expect(editionDialog.getByRole("spinbutton", { name: "Pages" })).toHaveValue("220");
		await expect(editionDialog.getByRole("textbox", { name: "ISBN", exact: true })).toHaveValue("9782070388523");
		// no organization Gallimard: the picker looks for it
		const publisher = editionDialog.getByRole("textbox", { name: "Éditeur", exact: true });
		await expect(publisher).toHaveAttribute("placeholder", "Gallimard");
		await publisher.focus();
		await expect(publisher).toHaveValue("Gallimard");
		await pickEntity(editionDialog, "Éditeur", "Gallimard");
		await editionDialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(editionDialog).not.toBeVisible();
		await expect(page.locator("section.edition")).toContainText(
			"Gallimard · Folio Classique · Livre · français · 220 pages · 1994",
		);
		const [{ external_id }] = await queryDb(
			`SELECT x.external_id FROM core.external_id x JOIN core.node n ON n.id = x.node_id
			 WHERE n.type = 'book_edition' AND x.source = 'openLibrary'`,
		);
		expect(external_id).toBe("OL7038372M");
	});

	test("Changer drops the result picked: the book keeps the fields, not the Open Library id", async ({ page }) => {
		const dialog = await openAddBook(page);
		await dialog.getByRole("textbox", { name: "Titre ou ISBN" }).fill("978-2-07-038852-3");
		await dialog.getByRole("button", { name: "Rechercher" }).click();
		await dialog.getByRole("button", { name: "Choisir Through the Looking-Glass" }).click();

		await dialog.getByRole("button", { name: "Changer" }).click();
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Another Book");
		await dialog.getByRole("button", { name: "Supprimer" }).nth(1).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		// the book page, not the edition form of the ISBN
		await expect(page.getByRole("heading", { name: "Another Book", level: 2 })).toBeVisible();
		const rows = await queryDb(
			`SELECT x.external_id FROM core.external_id x JOIN reading.book b ON b.id = x.node_id WHERE b.title = 'Another Book'`,
		);
		expect(rows).toEqual([]);
	});

	test("an unknown ISBN gives no result", async ({ page }) => {
		const dialog = await openAddBook(page);

		await dialog.getByRole("textbox", { name: "Titre ou ISBN" }).fill("9799999999990");
		await dialog.getByRole("button", { name: "Rechercher" }).click();

		await expect(dialog.getByText("Aucun résultat")).toBeVisible();
	});

	test("the edition form lists the editions of the book's work, by language", async ({ page }) => {
		await queryDb(
			`INSERT INTO core.external_id (node_id, source, external_id) VALUES ($1, 'openLibrary', 'OL102749W')`,
			[alice.id],
		);
		await page.goto(`/reading-book/book/${alice.id}`);
		await page.getByRole("button", { name: "Ajouter une édition" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une édition" });

		// the book's original language (English) first, with the editions without a language
		const language = dialog.getByRole("combobox", { name: "Langue des éditions" });
		await expect(language).toHaveValue("en");
		const results = dialog.locator(".lookup-results li");
		await expect(results).toHaveCount(2);
		await expect(results.first()).toContainText("Macmillan · Livre · anglais · 1871");
		await expect(results.nth(1)).toContainText("Independently published · Numérique · 2016");
		await language.selectOption({ label: "Toutes les langues" });
		await expect(results).toHaveCount(3);

		await dialog.getByRole("button", { name: /^Choisir Through the Looking-Glass \(Macmillan/ }).click();
		// not the book's title ("Alice's Adventures in Wonderland"): a title of its own
		await expect(dialog.getByRole("textbox", { name: "Titre de l'édition" })).toHaveValue(
			"Through the Looking-Glass",
		);
		await expect(dialog.getByRole("combobox", { name: "Type" })).toHaveValue("print");
		await expect(dialog.getByRole("textbox", { name: "Langue", exact: true })).toHaveValue("en");
		await expect(dialog.getByRole("spinbutton", { name: "Année" })).toHaveValue("1871");
	});

	test("the edition form searches by ISBN, also for an existing edition", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		await page.locator("section.edition").getByRole("button", { name: "Modifier l'édition" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'édition" });
		// the book has no Open Library work: no list of editions
		await expect(dialog.getByRole("combobox", { name: "Langue des éditions" })).toHaveCount(0);

		await dialog.getByRole("textbox", { name: "ISBN à rechercher" }).fill("9799999999990");
		await dialog.getByRole("textbox", { name: "ISBN à rechercher" }).press("Enter");
		await expect(dialog.getByText("Aucune édition pour cet ISBN")).toBeVisible();
		// Enter didn't submit the form
		await expect(dialog).toBeVisible();

		await dialog.getByRole("textbox", { name: "ISBN à rechercher" }).fill("978-2-07-038852-3");
		await dialog.getByRole("button", { name: "Rechercher" }).click();
		await dialog.getByRole("button", { name: /^Choisir De l'autre côté du miroir/ }).click();
		await expect(dialog.getByRole("textbox", { name: "Collection" })).toHaveValue("Folio Classique");
	});
});
