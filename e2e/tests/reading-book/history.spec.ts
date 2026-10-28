import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { alice, littleWomen, roman } = SEED.book;
const currentYear = new Date().getFullYear();

function bookCards(page: Page) {
	return page.locator(".reading-book .grid .card_item");
}

function bookCard(page: Page, name: string) {
	return bookCards(page).filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Reading Book - History", () => {
	test.afterEach(resetDb);

	test("module root redirects to the current year history", async ({ page }) => {
		await page.goto("/reading-book");
		await expect(page).toHaveURL(`/reading-book/history/${currentYear}`);
		await expect(page.getByRole("heading", { name: `Année ${currentYear}` })).toBeVisible();
	});

	test("2026 shows the books read that year", async ({ page }) => {
		await page.goto("/reading-book/history/2026");
		await expect(bookCards(page)).toHaveCount(3);

		const aliceCard = bookCard(page, alice.book);
		await expect(aliceCard).toContainText("Lewis Carroll");
		await expect(aliceCard).toContainText("1 lecture");
		await expect(aliceCard).toContainText("05/02/26 - 08/03/26 - 5 jours");
		await expect(aliceCard.locator(".fa-circle-check")).toBeVisible();

		await expect(bookCard(page, littleWomen.book).locator(".fa-ban")).toBeVisible();
		await expect(bookCard(page, roman.book).locator(".fa-circle-check")).toBeVisible();
	});

	test("navigate between years", async ({ page }) => {
		await page.goto("/reading-book/history/2026");
		await expect(bookCards(page)).toHaveCount(3);

		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page.getByRole("heading", { name: "Année 2025" })).toBeVisible();
		await expect(bookCards(page)).toHaveCount(0);

		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page.getByRole("heading", { name: "Année 2024" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();
	});

	test("next year is disabled on the current year", async ({ page }) => {
		await page.goto(`/reading-book/history/${currentYear}`);
		await expect(page.getByRole("heading", { name: `Année ${currentYear}` })).toBeVisible();
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
	});

	test("click a book opens its details", async ({ page }) => {
		await page.goto("/reading-book/history/2026");
		await page.getByRole("link", { name: littleWomen.book }).click();
		await expect(page).toHaveURL(`/reading-book/book/${littleWomen.id}`);
		await expect(page.getByRole("heading", { name: littleWomen.book })).toBeVisible();
	});

	test("add a book from the history", async ({ page }) => {
		await page.goto("/reading-book/history/2026");
		await page.getByRole("button", { name: "Ajouter un livre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
		await expect(dialog).toBeVisible();
		await dialog.locator('input[name="author.0.value"]').fill("History Author");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("History Book");
		await dialog.getByRole("spinbutton", { name: "Pages" }).fill("100");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(page.getByRole("heading", { name: "History Book" })).toBeVisible();
	});

	test("submenu switches between history and list", async ({ page }) => {
		await page.goto("/reading-book/history/2026");
		await page.getByRole("link", { name: "Liste" }).click();
		await expect(page).toHaveURL("/reading-book/list");
		await expect(page.locator("table.books")).toBeVisible();

		await page.getByRole("link", { name: "Historique" }).click();
		await expect(page).toHaveURL(`/reading-book/history/${currentYear}`);
	});
});
