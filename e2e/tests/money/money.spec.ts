import type { Page } from "@playwright/test";

import { expect, test, resetDb } from "../../fixtures";

// AccountBadge + the list displayed under it (payment types on overview, years/tags on analytics)
function accountBadgeBlock(page: Page, name: string) {
	return page
		.locator(".bank_accounts > div")
		.filter({ has: page.locator(".accountBadge .account").getByText(name, { exact: true }) });
}

function recapRow(page: Page, categoryName: string) {
	return page.getByRole("row").filter({ has: page.getByRole("cell", { name: categoryName, exact: true }) });
}

test.describe("Money", () => {
	test.describe("Overview", () => {
		test("overview page loads", async ({ page }) => {
			await page.goto("/money");
			await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();
			await expect(page.getByRole("heading", { name: "Main Bank" })).toBeVisible();
			await expect(page.getByRole("heading", { name: "Secondary Bank" })).toBeVisible();
			await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
		});

		test("shows accounts with their amount and payment types", async ({ page }) => {
			await page.goto("/money");
			const livretA = accountBadgeBlock(page, "Livret A");
			await expect(livretA).toContainText("5000.00 €");
			await expect(livretA.getByRole("listitem")).toHaveText(["Livret A"]);

			// Balance = history (30) + later transactions: Steam, Bandcamp, Kindle (-95.99)
			const cash = accountBadgeBlock(page, "Cash");
			await expect(cash).toContainText("-65.99 €");
		});

		test.describe("with an empty account", () => {
			test.afterEach(resetDb);

			test("empty accounts are hidden by default and can be shown", async ({ page }) => {
				// No seeded account is at 0: create one
				await page.goto("/money/accounts");
				await page.getByRole("button", { name: "Ajouter un compte" }).click();
				const dialog = page.getByRole("dialog", { name: "Ajouter un compte" });
				await dialog.getByRole("textbox", { name: "Nom" }).fill("Empty Account");
				await dialog.getByRole("combobox", { name: "Banque" }).selectOption({ label: "General" });
				await dialog.getByRole("button", { name: "Enregistrer" }).click();
				await expect(dialog).not.toBeVisible();

				await page.goto("/money");
				const hideEmpty = page.getByRole("checkbox", { name: "Cacher les comptes vides" });
				await expect(hideEmpty).toBeChecked();
				await expect(accountBadgeBlock(page, "Cash")).toBeVisible();
				const emptyAccount = accountBadgeBlock(page, "Empty Account");
				await expect(emptyAccount).not.toBeVisible();

				await hideEmpty.uncheck();
				await expect(emptyAccount).toBeVisible();
				await expect(emptyAccount).toContainText("0.00 €");
			});
		});

		test("clicking on an account opens its transactions", async ({ page }) => {
			await page.goto("/money");
			await accountBadgeBlock(page, "Cash").locator(".colorBadge").click();
			await expect(page).toHaveURL("/money/transactions/account/4");
		});
	});

	test.describe("Annual recap", () => {
		test("/money/reports redirects to the current year", async ({ page }) => {
			await page.clock.setFixedTime(new Date("2026-06-01T00:00:00Z"));
			await page.goto("/money/reports");
			await expect(page).toHaveURL("/money/reports/2026");
			await expect(page.getByRole("heading", { name: /Synthèse de l'année 2026/ })).toBeVisible();
		});

		test("categories are grouped by parent by default", async ({ page }) => {
			await page.goto("/money/reports/2026");
			await expect(page.getByRole("checkbox", { name: "Regrouper catégories" })).toBeChecked();
			// Sorted by absolute total: Hobbies (-95.99), Food (-55.50), Health (-50.00)
			const rows = page.locator("table.recap tbody tr");
			await expect(rows).toHaveCount(3);
			await expect(rows.locator("td:first-child")).toHaveText(["Hobbies", "Food", "Health"]);
			// Steam + Bandcamp (Music) + Kindle (Book)
			await expect(recapRow(page, "Hobbies").locator("td").last()).toContainText("-95.99");
			// Groceries + Groceries inside the Auchan split transaction
			await expect(recapRow(page, "Food").locator("td").last()).toContainText("-55.50");
		});

		test("categories can be split", async ({ page }) => {
			await page.goto("/money/reports/2026");
			await expect(recapRow(page, "Hobbies")).toBeVisible();
			await page.getByRole("checkbox", { name: "Regrouper catégories" }).uncheck();

			await expect(page.locator("table.recap tbody tr")).toHaveCount(5);
			await expect(recapRow(page, "Hobbies").locator("td").last()).toContainText("-69.00");
			await expect(recapRow(page, "Hobbies > Music").locator("td").last()).toContainText("-20.00");
			await expect(recapRow(page, "Hobbies > Book").locator("td").last()).toContainText("-6.99");
		});

		test("navigate to the previous year", async ({ page }) => {
			await page.goto("/money/reports/2026");
			await page.getByRole("button", { name: "Previous year" }).click();
			await expect(page).toHaveURL("/money/reports/2025");
			await expect(page.getByRole("heading", { name: /Synthèse de l'année 2025/ })).toBeVisible();
			// Restaurant + Bar
			await expect(page.locator("table.recap tbody tr")).toHaveCount(1);
			await expect(recapRow(page, "Food").locator("td").last()).toContainText("-37.00");
		});
	});

	test.describe("Analytics", () => {
		test("tags are grouped by parent, with a total per year", async ({ page }) => {
			await page.goto("/money/analytics");
			await expect(page.getByRole("heading", { name: "Analytique" })).toBeVisible();
			await expect(page.getByRole("heading", { name: "Food" })).toBeVisible();

			// Food\Miam: Groceries (-45.50) + Groceries in Auchan (-10) in 2026, Restaurant (-25) in 2025
			const miam = accountBadgeBlock(page, "Miam");
			await expect(miam.locator(".accountBadge")).toContainText("-80.50 € (3)");
			await expect(miam.getByRole("listitem")).toHaveText(["2025 : -25.00 € (1)", "2026 : -55.50 € (2)"]);

			// Food\Drink: Bar (-12) in 2025
			const drink = accountBadgeBlock(page, "Drink");
			await expect(drink.locator(".accountBadge")).toContainText("-12.00 € (1)");
			await expect(drink.getByRole("listitem")).toHaveText(["2025 : -12.00 € (1)"]);
		});

		test("split by years", async ({ page }) => {
			await page.goto("/money/analytics");
			await page.getByRole("checkbox", { name: "Séparer par années" }).check();

			const food2025 = accountBadgeBlock(page, "Food 2025");
			await expect(food2025.locator(".accountBadge")).toContainText("-37.00 € (2)");
			await expect(food2025.getByRole("listitem")).toHaveText(["Miam : -25.00 € (1)", "Drink : -12.00 € (1)"]);

			const food2026 = accountBadgeBlock(page, "Food 2026");
			await expect(food2026.locator(".accountBadge")).toContainText("-55.50 € (2)");
			await expect(food2026.getByRole("listitem")).toHaveText(["Miam : -55.50 € (2)"]);
		});
	});
});
