import type { Page } from "@playwright/test";

import { expect, pickEntity, resetDb, SEED, test } from "../../fixtures";

const { alice } = SEED.book;

// Served by e2e/mocks/fetch-mock.mjs
const COVER_URL = "https://images.example.com/book-cover.svg";
const SVG_COVER = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90"><rect width="60" height="90" fill="teal"/></svg>',
);

// The heading's name also holds its buttons' titles ("Édition Modifier l'édition …"): matched on the title only
function edition(page: Page, title: string) {
	const name = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`);
	return page.locator("section.edition").filter({ has: page.getByRole("heading", { name, level: 3 }) });
}

async function addEdition(page: Page, fields: { title: string; cover?: string }) {
	await page.goto(`/reading-book/book/${alice.id}`);
	await page.getByRole("button", { name: "Ajouter une édition" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter une édition" });
	await dialog.getByRole("textbox", { name: "Titre de l'édition" }).fill(fields.title);
	if (fields.cover) {
		await dialog.getByRole("textbox", { name: "Image" }).fill(fields.cover);
	}
	return dialog;
}

test.describe("Reading Book - Editions", () => {
	test.afterEach(resetDb);

	test("add an edition with its cover, publisher and translator, then read it", async ({ page }) => {
		const dialog = await addEdition(page, { title: "Alice au pays des merveilles", cover: COVER_URL });
		await pickEntity(dialog, "Éditeur", "Folio");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption("Livre");
		await dialog.getByRole("textbox", { name: "Langue" }).fill("fr");
		await dialog.getByRole("spinbutton", { name: "Pages" }).fill("220");
		await dialog.getByRole("spinbutton", { name: "Année" }).fill("1994");
		await dialog.getByRole("button", { name: "Ajouter un·e traducteur·ice" }).click();
		await pickEntity(dialog, "Traducteur·ice 1", "Henri Parisot");
		await dialog.getByRole("textbox", { name: "Traducteur·ice 1 crédité·e comme" }).fill("H. Parisot");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const card = edition(page, "Alice au pays des merveilles");
		await expect(card).toContainText("Folio · Livre · fr · 220 pages · 1994");
		await expect(card).toContainText("Traduction : H. Parisot");
		const cover = card.getByRole("img", { name: "Couverture de Alice au pays des merveilles" });
		await expect(cover).toHaveAttribute("src", /\/images\/reading-book\/edition\/[0-9a-f-]+\?v=[0-9a-f]+$/);
		// the cover is served by the images proxy
		await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

		await card.getByRole("button", { name: "+ Commencer une lecture" }).click();
		await expect(card.getByRole("heading", { name: "Lecture #1" })).toBeVisible();
		// the reading of the seeded edition stays on it
		await expect(edition(page, "Édition").getByRole("heading", { name: "Lecture #1" })).toBeVisible();
	});

	test("upload a cover file, then remove it", async ({ page }) => {
		const dialog = await addEdition(page, { title: "Édition numérique" });
		await dialog
			.getByLabel("Fichier de couverture")
			.setInputFiles({ name: "cover.svg", mimeType: "image/svg+xml", buffer: SVG_COVER });
		await expect(dialog.getByRole("img", { name: "Couverture" })).toBeVisible();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		const card = edition(page, "Édition numérique");
		await expect(card.getByRole("img", { name: /^Couverture de/ })).toBeVisible();

		await card.getByRole("button", { name: "Modifier l'édition" }).click();
		const editDialog = page.getByRole("dialog", { name: "Modifier l'édition" });
		await editDialog.getByRole("button", { name: "Retirer la couverture" }).click();
		await editDialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(editDialog).not.toBeVisible();
		await expect(card.getByRole("img")).toHaveCount(0);
	});

	test("an edition with readings can't be deleted", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		await edition(page, "Édition").getByRole("button", { name: "Supprimer l'édition" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer l'édition" });

		await expect(dialog).toContainText("Cette édition a des lectures : supprimez-les d'abord.");
		await expect(dialog.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
	});

	test("delete an edition without readings", async ({ page }) => {
		const dialog = await addEdition(page, { title: "Édition à supprimer" });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.locator("section.edition")).toHaveCount(2);

		await edition(page, "Édition à supprimer").getByRole("button", { name: "Supprimer l'édition" }).click();
		await page
			.getByRole("dialog", { name: "Supprimer l'édition" })
			.getByRole("button", { name: "Supprimer" })
			.click();

		await expect(page.locator("section.edition")).toHaveCount(1);
	});

	test("a book keeps at least one edition", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		// the seeded edition has readings: a new book's edition doesn't
		await page.getByRole("link", { name: "Liste" }).click();
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const bookDialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await pickEntity(bookDialog, "Auteur·ice 1", "Someone");
		await bookDialog.getByRole("textbox", { name: "Nom" }).fill("Single Edition Book");
		await bookDialog.getByRole("button", { name: "Enregistrer" }).click();

		await edition(page, "Édition").getByRole("button", { name: "Supprimer l'édition" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer l'édition" });
		await expect(dialog).toContainText("Un livre garde au moins une édition.");
		await expect(dialog.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
	});

	// the delete modals don't offer it: the server's own checks are called directly
	test("the server refuses to delete an edition or a model with readings", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		const book = await (await page.request.get(`/api/reading-book/books/${alice.id}`)).json();

		const editionRes = await page.request.delete(
			`/api/reading-book/books/${alice.id}/editions/${book.editions[0].id}`,
		);
		expect(editionRes.status()).toBe(409);
		expect((await editionRes.json()).message).toContain("Cette édition a des lectures");

		const modelRes = await page.request.delete(`/api/reading-book/books/${alice.id}/models/${book.models[0].id}`);
		expect(modelRes.status()).toBe(409);

		await page.reload();
		await expect(page.locator("section.edition")).toHaveCount(1);
		await expect(page.getByRole("heading", { name: "Lecture #1" })).toBeVisible();
	});
});
