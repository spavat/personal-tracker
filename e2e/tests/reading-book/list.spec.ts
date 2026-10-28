import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { alice, littleWomen, roman } = SEED.book;

function bookRows(page: Page) {
	return page.locator("table.books tbody tr");
}

// Second column holds the book name
function bookNames(page: Page) {
	return bookRows(page).locator("td:nth-child(2)");
}

test.describe("Reading Book - List", () => {
	test.afterEach(resetDb);

	test("list shows the 3 seeded books", async ({ page }) => {
		await page.goto("/reading-book/list");
		await expect(bookRows(page)).toHaveCount(3);

		const aliceRow = bookRows(page).filter({ hasText: alice.book });
		await expect(aliceRow.locator("td")).toHaveText([
			"#1",
			alice.book,
			"Lewis Carroll",
			"en",
			"",
			"1",
			"05/02/26",
			"08/03/26",
			"181 pages",
			"",
		]);
		await expect(aliceRow.locator(".fi-gb")).toBeAttached();
	});

	test("sort by book name", async ({ page }) => {
		await page.goto("/reading-book/list");
		await expect(bookNames(page)).toHaveText([alice.book, littleWomen.book, roman.book]);

		const header = page.getByRole("columnheader", { name: "Livre" });
		await expect(header.locator(".fa-sort-up")).toBeVisible();

		await header.getByText("Livre").click();
		await expect(header.locator(".fa-sort-down")).toBeVisible();
		await expect(bookNames(page)).toHaveText([roman.book, littleWomen.book, alice.book]);

		await header.getByText("Livre").click();
		await expect(header.locator(".fa-sort-up")).toBeVisible();
		await expect(bookNames(page)).toHaveText([alice.book, littleWomen.book, roman.book]);
	});

	test("sort by pages", async ({ page }) => {
		await page.goto("/reading-book/list");
		await page.getByRole("columnheader", { name: "Pages" }).getByText("Pages").click();
		await expect(bookNames(page)).toHaveText([alice.book, roman.book, littleWomen.book]);
	});

	test("click a book opens its details", async ({ page }) => {
		await page.goto("/reading-book/list");
		await page.getByRole("link", { name: roman.book }).click();
		await expect(page).toHaveURL(`/reading-book/book/${roman.id}`);
		await expect(page.getByRole("heading", { name: roman.book })).toBeVisible();
	});

	test("add a new book", async ({ page }) => {
		await page.goto("/reading-book/list");
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await expect(dialog).toBeVisible();

		await dialog.locator('input[name="author.0.value"]').fill("New Author");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("New Test Book");
		await dialog.getByRole("textbox", { name: "Langue" }).fill("fr");
		await dialog.getByRole("textbox", { name: "Pays" }).fill("fr");
		await dialog.getByRole("spinbutton", { name: "Pages" }).fill("200");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		// Redirected to the page of the new book
		await expect(page.getByRole("heading", { name: "New Test Book" })).toBeVisible();
		await expect(page.getByText("Auteur.ic.es: New Author")).toBeVisible();

		await page.getByRole("link", { name: "Liste" }).click();
		await expect(bookRows(page)).toHaveCount(4);
		await expect(bookRows(page).filter({ hasText: "New Test Book" })).toContainText("200 pages");
	});

	test("book name is required", async ({ page }) => {
		await page.goto("/reading-book/list");
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await dialog.locator('input[name="author.0.value"]').fill("New Author");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await expect(dialog).toBeVisible();
		await expect(page).toHaveURL("/reading-book/list");
	});

	test("an author is required", async ({ page }) => {
		await page.goto("/reading-book/list");
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("No Author Book");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Au moins un auteur est obligatoire")).toBeVisible();
		await expect(dialog).toBeVisible();
	});

	test("the page count is optional", async ({ page }) => {
		await page.goto("/reading-book/list");
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await dialog.locator('input[name="author.0.value"]').fill("New Author");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("No Pages Book");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(page.getByRole("heading", { name: "No Pages Book" })).toBeVisible();
		await expect(page.locator(".details .general")).not.toContainText("pages");

		await page.getByRole("link", { name: "Liste" }).click();
		await expect(bookRows(page).filter({ hasText: "No Pages Book" }).locator("td").nth(8)).toHaveText("");
	});

	test("cancel the add modal", async ({ page }) => {
		await page.goto("/reading-book/list");
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Cancelled Book");
		await dialog.getByRole("button", { name: "Annuler" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(bookRows(page)).toHaveCount(3);
	});
});
