import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

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
		await expect(general).toContainText("Langage : en");
		await expect(general).toContainText("Pays : gb");
		await expect(general).toContainText("Pages : 181 pages");

		await expect(page.getByRole("heading", { name: "Lecture #1" })).toBeVisible();
		const model = page.locator(".card_item").filter({ has: page.getByRole("heading", { name: "Modèle" }) });
		await expect(model.locator("ul ul > li")).toHaveCount(12);
		await expect(model).toContainText("I: Down the Rabbit-Hole");
	});

	test("edit the book", async ({ page }) => {
		const dialog = await openEditModal(page);
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue(alice.book);
		await expect(dialog.locator('input[name="author.0.value"]')).toHaveValue("Lewis Carroll");
		await expect(dialog.getByRole("spinbutton", { name: "Pages" })).toHaveValue("181");

		await dialog.getByRole("textbox", { name: "Nom" }).fill("Alice in Wonderland");
		await dialog.getByRole("spinbutton", { name: "Pages" }).fill("200");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Alice in Wonderland" })).toBeVisible();
		await expect(page.locator(".details .general")).toContainText("Pages : 200 pages");
	});

	test("add and remove an author", async ({ page }) => {
		let dialog = await openEditModal(page);
		await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
		await dialog.locator('input[name="author.1.value"]').fill("John Tenniel");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByText("Auteur.ic.es: Lewis Carroll, John Tenniel")).toBeVisible();

		dialog = await openEditModal(page);
		await dialog.getByRole("button", { name: "Supprimer" }).first().click();
		await expect(dialog.locator('input[name="author.0.value"]')).toHaveValue("John Tenniel");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByText("Auteur.ic.es: John Tenniel")).toBeVisible();
	});

	test("clear the page count", async ({ page }) => {
		const dialog = await openEditModal(page);
		await dialog.getByRole("spinbutton", { name: "Pages" }).clear();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await page.reload();
		await expect(page.locator(".details .general")).not.toContainText("181");
		await expect(page.locator(".details .general")).not.toContainText("pages");
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
