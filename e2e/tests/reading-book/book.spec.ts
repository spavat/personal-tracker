import type { Page } from "@playwright/test";

import { expect, pickEntity, resetDb, SEED, test } from "../../fixtures";

const { alice } = SEED.book;

async function openEditModal(page: Page) {
	await page.goto(`/reading-book/book/${alice.id}`);
	await page.getByRole("heading", { name: alice.book }).getByRole("button", { name: "Modifier" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier le livre" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Reading Book - Details", () => {
	test.afterEach(resetDb);

	test("details page shows the book", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		await expect(page.getByRole("heading", { name: alice.book })).toBeVisible();

		const general = page.locator(".details .general");
		await expect(general).toContainText("Auteur.ic.es: Lewis Carroll");
		await expect(general).toContainText("Langue originale : en");
		await expect(general).toContainText("Pays : gb");
		await expect(page.locator("section.edition")).toContainText("en · 181 pages");

		await expect(page.getByRole("heading", { name: "Lecture #1" })).toBeVisible();
		const model = page.locator(".card_item.model");
		// its 12 chapters, cut to the first 5 and "…"
		await expect(model.locator("ul ul > li")).toHaveCount(6);
		await expect(model.locator("ul ul > li").last()).toHaveText("…");
		await expect(model).toContainText("I: Down the Rabbit-Hole");
	});

	test("edit the book", async ({ page }) => {
		const dialog = await openEditModal(page);
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue(alice.book);
		await expect(dialog.getByRole("textbox", { name: "Auteur·ice 1", exact: true })).toHaveValue("Lewis Carroll");
		await expect(dialog.getByRole("textbox", { name: "Langue originale" })).toHaveValue("en");

		await dialog.getByRole("textbox", { name: "Nom" }).fill("Alice in Wonderland");
		await dialog.getByRole("textbox", { name: "Langue originale" }).fill("en-GB");
		await expect(dialog.getByRole("spinbutton", { name: "Année de publication" })).toHaveValue("");
		await dialog.getByRole("spinbutton", { name: "Année de publication" }).fill("1865");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Alice in Wonderland" })).toBeVisible();
		const general = page.locator(".details .general");
		await expect(general).toContainText("Langue originale : en-GB");
		await expect(general).toContainText("Année de publication : 1865");
	});

	test("add and remove an author", async ({ page }) => {
		let dialog = await openEditModal(page);
		await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
		await pickEntity(dialog, "Auteur·ice 2", "John Tenniel");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByText("Auteur.ic.es: Lewis Carroll, John Tenniel")).toBeVisible();

		dialog = await openEditModal(page);
		await dialog.getByRole("button", { name: "Supprimer" }).first().click();
		await expect(dialog.getByRole("textbox", { name: "Auteur·ice 1", exact: true })).toHaveValue("John Tenniel");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByText("Auteur.ic.es: John Tenniel")).toBeVisible();
	});

	test("clear the page count of an edition", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		await page.getByRole("button", { name: "Modifier l'édition" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'édition" });
		await expect(dialog.getByRole("spinbutton", { name: "Pages" })).toHaveValue("181");
		await dialog.getByRole("spinbutton", { name: "Pages" }).clear();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await page.reload();
		await expect(page.locator("section.edition .edition-info")).not.toContainText("pages");
	});

	test("cancel the edit", async ({ page }) => {
		const dialog = await openEditModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Should not be saved");
		await dialog.getByRole("button", { name: "Annuler" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: alice.book })).toBeVisible();
		await page.reload();
		await expect(page.getByRole("heading", { name: alice.book })).toBeVisible();
	});
});
