import type { Page } from "@playwright/test";

import { expect, test } from "../../fixtures";

// Transaction rows are the only rows with a selection checkbox (not year/month separators nor thresholds)
function transactionRows(page: Page) {
	return page.getByRole("row").filter({ has: page.getByRole("checkbox", { name: "Sélectionner" }) });
}

function transactionLink(page: Page, name: string) {
	return page.getByRole("link", { name, exact: true });
}

test.describe("Grouped transactions", () => {
	test.describe("Category", () => {
		test("parent category shows its own transactions and those of its children", async ({ page }) => {
			await page.goto("/money/transactions/category/4"); // Hobbies
			await expect(page.getByRole("heading", { name: "Détails de la catégorie Hobbies" })).toBeVisible();
			await expect(transactionRows(page)).toHaveCount(3);
			await expect(transactionLink(page, "Steam")).toBeVisible(); // Hobbies
			await expect(transactionLink(page, "Bandcamp")).toBeVisible(); // Hobbies > Music
			await expect(transactionLink(page, "Kindle")).toBeVisible(); // Hobbies > Book
			await expect(page.locator("tfoot")).toContainText("3 transactions");
			await expect(page.locator("tfoot")).toContainText("-95.99");
		});

		test("child category shows only its own transactions", async ({ page }) => {
			await page.goto("/money/transactions/category/5"); // Hobbies > Music
			await expect(page.getByRole("heading", { name: "Détails de la catégorie Hobbies > Music" })).toBeVisible();
			await expect(transactionRows(page)).toHaveCount(1);
			await expect(transactionLink(page, "Bandcamp")).toBeVisible();
			await expect(transactionLink(page, "Steam")).not.toBeVisible();
			await expect(transactionLink(page, "Kindle")).not.toBeVisible();
		});

		test("category includes sub-transactions of split transactions", async ({ page }) => {
			await page.goto("/money/transactions/category/1"); // Food
			// Groceries, Restaurant, Bar + Groceries inside the "Auchan" split transaction
			await expect(page.getByRole("heading", { name: "Détails de la catégorie Food" })).toBeVisible();
			await expect(transactionRows(page)).toHaveCount(4);
			const splitRow = transactionRows(page).filter({ has: transactionLink(page, "Auchan") });
			await expect(splitRow).toContainText("Groceries");
		});
	});

	test.describe("Tag", () => {
		test("tag shows its transactions, including sub-transactions", async ({ page }) => {
			await page.goto("/money/transactions/tag/1"); // Food\Miam
			await expect(page.getByRole("heading", { name: "Détails du tag Food\\Miam" })).toBeVisible();
			await expect(transactionRows(page)).toHaveCount(3);
			await expect(transactionLink(page, "Restaurant")).toBeVisible();
			await expect(transactionLink(page, "Groceries")).toBeVisible();
			const splitRow = transactionRows(page).filter({ has: transactionLink(page, "Auchan") });
			await expect(splitRow).toContainText("Groceries");
			await expect(transactionLink(page, "Bar")).not.toBeVisible(); // Food\Drink
		});
	});

	test.describe("Account", () => {
		test("account shows the transactions of its payment types", async ({ page }) => {
			await page.goto("/money/transactions/account/4"); // Cash
			await expect(page.getByRole("heading", { name: "Détails du compte Cash" })).toBeVisible();
			await expect(transactionRows(page)).toHaveCount(3);
			await expect(transactionLink(page, "Steam")).toBeVisible();
			await expect(transactionLink(page, "Bandcamp")).toBeVisible();
			await expect(transactionLink(page, "Kindle")).toBeVisible();
			await expect(transactionLink(page, "Groceries")).not.toBeVisible(); // Card Main Bank
		});
	});
});
