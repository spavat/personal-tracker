import type { Page } from "@playwright/test";

import { expect, queryDb, resetDb, test } from "../../fixtures";

// Top level transaction row (children rows have no link)
function transactionRow(page: Page, name: string) {
	return page.getByRole("row").filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Transactions", () => {
	test("Transaction home page (/money/transactions) redirects to the transactions of the current month", async ({
		page,
	}) => {
		await page.clock.setFixedTime(new Date("2026-06-01T00:00:00Z"));
		await page.goto("/money/transactions");
		await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
		await expect(page.getByRole("table").getByRole("row")).toHaveCount(5); // 3 data rows + 1 header row + 1 footer row
	});

	test.describe("Navigation", () => {
		test.describe("with Keyboard", () => {
			test("ctrl+left goes to previous month (2026-06 -> 2026-05)", async ({ page }) => {
				await page.goto("/money/transactions/2026-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
				await page.keyboard.press("Control+ArrowLeft");
				await expect(page).toHaveURL("/money/transactions/2026-05");
				await expect(page.locator(".month-year-selector")).toContainText("mai 2026");
			});
			test("ctrl+right goes to next month (2026-06 -> 2026-07)", async ({ page }) => {
				await page.goto("/money/transactions/2026-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
				await page.keyboard.press("Control+ArrowRight");
				await expect(page).toHaveURL("/money/transactions/2026-07");
				await expect(page.locator(".month-year-selector")).toContainText("juillet 2026");
			});
		});
		test.describe("with Button", () => {
			test("Clicking of the previous year button (2026-06 -> 2025-06)", async ({ page }) => {
				await page.goto("/money/transactions/2026-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
				await page.getByRole("button", { name: "Année précédente" }).click();
				await expect(page).toHaveURL("/money/transactions/2025-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2025");
			});
			test("Clicking of the previous month button (2026-06 -> 2026-05)", async ({ page }) => {
				await page.goto("/money/transactions/2026-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
				await page.getByRole("button", { name: "Mois précédent" }).click();
				await expect(page).toHaveURL("/money/transactions/2026-05");
				await expect(page.locator(".month-year-selector")).toContainText("mai 2026");
			});
			test("Clicking of the current month button (2026-01 -> 2026-06)", async ({ page }) => {
				await page.clock.setFixedTime(new Date("2026-06-01T00:00:00Z"));
				await page.goto("/money/transactions/2026-01");
				await expect(page.locator(".month-year-selector")).toContainText("janvier 2026");
				await page.getByRole("button", { name: "Mois courant" }).click();
				await expect(page).toHaveURL("/money/transactions/2026-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
			});
			test("Clicking of the previous month button (2026-06 -> 2026-07)", async ({ page }) => {
				await page.goto("/money/transactions/2026-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
				await page.getByRole("button", { name: "Mois suivant" }).click();
				await expect(page).toHaveURL("/money/transactions/2026-07");
				await expect(page.locator(".month-year-selector")).toContainText("juillet 2026");
			});
			test("Clicking of the previous month button (2026-06 -> 2027-06)", async ({ page }) => {
				await page.goto("/money/transactions/2026-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
				await page.getByRole("button", { name: "Année suivante" }).click();
				await expect(page).toHaveURL("/money/transactions/2027-06");
				await expect(page.locator(".month-year-selector")).toContainText("juin 2027");
			});
		});
	});

	test.describe("Quick edit", () => {
		test.afterEach(resetDb);

		test("Quick edit a transaction (save)", async ({ page }) => {
			// Load page
			await page.goto("/money/transactions/2026-06");
			await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
			// Check page
			const row = page.locator("table tr:has-text('Doctor')");
			await expect(row.getByRole("cell").nth(3)).toContainText("Doctor");
			await expect(row.getByRole("cell").nth(4)).toContainText("-30");
			await expect(row.getByRole("cell").nth(5)).toContainText("Health");
			await expect(row.getByRole("cell").nth(6)).toContainText("Card Main Bank");
			// Click to enable quick edit
			page.locator("table tr:has-text('Doctor')")
				.getByRole("button", { name: "Quick edit transaction" })
				.first()
				.click();
			await expect(page.locator('input[name="name"]')).toBeVisible();
			await expect(page.locator('input[name="description"]')).toBeVisible();
			// Fill form & save changes
			await page.getByRole("textbox", { name: "name" }).fill("Doctor 2");
			await page.getByRole("textbox", { name: "description" }).fill("Paris");
			await page.getByRole("textbox", { name: "amount" }).fill("-25");
			await page.getByRole("combobox", { name: "category" }).selectOption({ label: "Food" });
			await page.getByRole("combobox", { name: "payment type" }).selectOption({ label: "Cash" });
			page.locator("table").getByRole("button", { name: "Save changes" }).first().click();
			// Assertion
			await expect(page.locator('input[name="name"]')).not.toBeVisible();
			const updatedRow = page.locator("table tr:has-text('Doctor 2')");
			await expect(updatedRow.getByRole("cell").nth(3)).toContainText("Doctor 2 - Paris");
			await expect(updatedRow.getByRole("cell").nth(4)).toContainText("-25");
			await expect(updatedRow.getByRole("cell").nth(5)).toContainText("Food");
			await expect(updatedRow.getByRole("cell").nth(6)).toContainText("Cash");
		});

		test("Quick edit a transaction (cancel)", async ({ page }) => {
			// Load page
			await page.goto("/money/transactions/2026-06");
			await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
			// Check page
			const row = page.locator("table tr:has-text('Doctor')");
			await expect(row.getByRole("cell").nth(3)).toContainText("Doctor");
			await expect(row.getByRole("cell").nth(4)).toContainText("-30");
			await expect(row.getByRole("cell").nth(5)).toContainText("Health");
			await expect(row.getByRole("cell").nth(6)).toContainText("Card Main Bank");
			// Click to enable quick edit
			page.locator("table tr:has-text('Doctor')")
				.getByRole("button", { name: "Quick edit transaction" })
				.first()
				.click();
			await expect(page.locator('input[name="name"]')).toBeVisible();
			await expect(page.locator('input[name="description"]')).toBeVisible();
			// Fill form & save changes
			await page.getByRole("textbox", { name: "name" }).fill("Doctor 2");
			await page.getByRole("textbox", { name: "description" }).fill("Paris");
			await page.getByRole("textbox", { name: "amount" }).fill("-25");
			await page.getByRole("combobox", { name: "category" }).selectOption({ label: "Food" });
			await page.getByRole("combobox", { name: "payment type" }).selectOption({ label: "Cash" });
			page.locator("table").getByRole("button", { name: "Cancel changes" }).first().click();
			// Assertion
			await expect(page.locator('input[name="name"]')).not.toBeVisible();
			const updatedRow = page.locator("table tr:has-text('Doctor')");
			await expect(updatedRow.getByRole("cell").nth(3)).toContainText("Doctor");
			await expect(updatedRow.getByRole("cell").nth(4)).toContainText("-30");
			await expect(updatedRow.getByRole("cell").nth(5)).toContainText("Health");
			await expect(updatedRow.getByRole("cell").nth(6)).toContainText("Card Main Bank");
		});
	});

	test.describe("Normal edit", () => {
		test.afterEach(resetDb);
		test("Update a simple transaction (save)", async ({ page }) => {
			// Load page
			await page.goto("/money/transactions/2026-06");
			await expect(page.locator(".month-year-selector")).toContainText("juin 2026");
			// Click to open the update modal
			page.locator("table tr:has-text('Doctor')")
				.getByRole("button", { name: "Edit transaction", exact: true })
				.first()
				.click();
			// Assert modal
			await expect(page.getByRole("dialog", { name: "Modifier une transaction" })).toBeVisible();
			// Fill form & save changes
			await page.getByRole("textbox", { name: "Nom" }).fill("Doctor 3");
			await page.getByRole("textbox", { name: "Description" }).fill("Marseille");
			await page.getByRole("spinbutton", { name: "Montant" }).fill("-35");
			await page.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Transport" });
			await page.getByRole("combobox", { name: "Paiement" }).selectOption({ label: "Card Secondary Bank" });
			await page.getByRole("textbox", { name: "Commentaire" }).fill("My comment\non two lines");
			await page.getByRole("button", { name: "Enregister" }).click();
			// Assertion
			await expect(page.locator('input[name="name"]')).not.toBeVisible();
			const updatedRow = page.getByRole("row").nth(2);
			await expect(updatedRow.getByRole("cell").nth(3)).toContainText("Doctor 3 - Marseille");
			await expect(updatedRow.getByRole("cell").nth(4)).toContainText("-35");
			await expect(updatedRow.getByRole("cell").nth(5)).toContainText("Transport");
			await expect(updatedRow.getByRole("cell").nth(6)).toContainText("Card Secondary Bank");
		});

		test("Update a transaction with children (save)", async ({ page }) => {
			await page.goto("/money/transactions/2026-06");
			await transactionRow(page, "Auchan").getByRole("button", { name: "Edit transaction", exact: true }).click();
			const dialog = page.getByRole("dialog", { name: "Modifier une transaction" });
			await expect(dialog).toBeVisible();
			// Wait for the form to be prefilled before editing
			await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue("Auchan");
			await expect(dialog.getByRole("checkbox", { name: "Transaction avec enfants" })).toBeChecked();
			await expect(dialog.locator('input[name="children.0.name"]')).toHaveValue("Groceries");
			// Update parent & children
			await dialog.getByRole("textbox", { name: "Description" }).fill("Saturday shopping");
			await dialog.locator('input[name="children.0.name"]').fill("Vegetables");
			await dialog.locator('input[name="children.0.amount"]').fill("-12");
			await dialog.getByRole("checkbox", { name: "Montrer commentaire & tags" }).check();
			await dialog.locator('textarea[name="children.1.comment"]').fill("Pharmacy");
			await dialog.getByRole("button", { name: "Enregister" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			const row = transactionRow(page, "Auchan");
			await expect(row).toContainText("Saturday shopping");
			await row.getByRole("button", { name: "Expand transaction" }).click();
			await expect(page.locator("#transaction-4")).toContainText("Vegetables");
			await expect(page.locator("#transaction-4")).toContainText("-12");
			// Child comment isn't displayed in the list: check it in database
			const [child] = await queryDb("SELECT comment FROM money.transaction WHERE id = 5");
			expect(child.comment).toBe("Pharmacy");
		});
	});

	test.describe("Expand / collapse", () => {
		test("Expand and collapse a transaction with children", async ({ page }) => {
			await page.goto("/money/transactions/2026-06");
			const row = transactionRow(page, "Auchan");
			const groceries = page.locator("#transaction-4");
			const health = page.locator("#transaction-5");
			// Collapsed by default: children hidden, their categories are displayed on the parent
			await expect(groceries).toBeHidden();
			await expect(health).toBeHidden();
			await expect(row.getByRole("cell").nth(5)).toContainText("Food");
			await expect(row.getByRole("cell").nth(5)).toContainText("Health");
			// Expand
			await row.getByRole("button", { name: "Expand transaction" }).click();
			await expect(groceries).toBeVisible();
			await expect(groceries).toContainText("Groceries");
			await expect(health).toBeVisible();
			await expect(health).toContainText("Health");
			// Collapse
			await row.getByRole("button", { name: "Collapse transaction" }).click();
			await expect(groceries).toBeHidden();
			await expect(health).toBeHidden();
		});
	});

	test.describe("Quick edit child", () => {
		test.afterEach(resetDb);

		test("Quick edit a child transaction (save)", async ({ page }) => {
			await page.goto("/money/transactions/2026-06");
			await transactionRow(page, "Auchan").getByRole("button", { name: "Expand transaction" }).click();
			const child = page.locator("#transaction-4");
			await expect(child).toContainText("Groceries");
			// Click to enable quick edit
			await child.getByRole("button", { name: "Modifier" }).click();
			await expect(child.locator('input[name="name"]')).toHaveValue("Groceries");
			// Fill form & save changes
			await child.locator('input[name="name"]').fill("Vegetables");
			await child.locator('input[name="amount"]').fill("-12");
			await child.locator('select[name="categoryId"]').selectOption({ label: "Hobbies" });
			await child.getByRole("button", { name: "Enregistrer" }).click();
			// Assertion
			await expect(child.locator('input[name="name"]')).not.toBeVisible();
			await expect(child.getByRole("cell").nth(3)).toContainText("Vegetables");
			await expect(child.getByRole("cell").nth(4)).toContainText("-12");
			await expect(child.getByRole("cell").nth(5)).toContainText("Hobbies");
		});
	});

	test.describe("Create", () => {
		test.afterEach(resetDb);
		test.beforeEach(async ({ page }) => {
			// New transactions are created at today's date
			await page.clock.setFixedTime(new Date("2026-06-15T10:00:00Z"));
		});

		test("Create a simple transaction with tags and comment", async ({ page }) => {
			await page.goto("/money/transactions/2026-06");
			await page.getByRole("button", { name: "Ajouter une transaction" }).click();
			const dialog = page.getByRole("dialog", { name: "Ajouter une transaction" });
			await expect(dialog).toBeVisible();
			// Fill form
			await dialog.getByRole("textbox", { name: "Nom" }).fill("Cinema");
			await dialog.getByRole("textbox", { name: "Description" }).fill("Avatar");
			await dialog.getByRole("spinbutton", { name: "Montant" }).fill("-15");
			await dialog.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Hobbies" });
			await dialog.getByRole("combobox", { name: "Paiement" }).selectOption({ label: "Cash" });
			const tagSelect = dialog.getByRole("combobox", { name: "tags" });
			await tagSelect.selectOption({ label: "Food\\Miam" });
			await dialog.getByRole("button", { name: "Add" }).click();
			await tagSelect.selectOption({ label: "Food\\Drink" });
			await dialog.getByRole("button", { name: "Add" }).click();
			await dialog.getByRole("textbox", { name: "Commentaire" }).fill("With friends");
			await dialog.getByRole("button", { name: "Enregister" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			const row = transactionRow(page, "Cinema");
			await expect(row.getByRole("cell").nth(3)).toContainText("Cinema - Avatar");
			await expect(row.getByRole("cell").nth(3)).toContainText("With friends"); // comment tooltip
			await expect(row.getByRole("cell").nth(4)).toContainText("-15");
			await expect(row.getByRole("cell").nth(5)).toContainText("Hobbies");
			await expect(row.getByRole("cell").nth(6)).toContainText("Cash");
			// Tags are only displayed on demand
			await page.getByRole("checkbox", { name: "Afficher les tags" }).check();
			await expect(row.getByRole("cell").nth(3)).toContainText("Food\\Miam");
			await expect(row.getByRole("cell").nth(3)).toContainText("Food\\Drink");
		});

		test("Create a transaction with 3 children, tags and comments", async ({ page }) => {
			await page.goto("/money/transactions/2026-06");
			await page.getByRole("button", { name: "Ajouter une transaction" }).click();
			const dialog = page.getByRole("dialog", { name: "Ajouter une transaction" });
			await expect(dialog).toBeVisible();
			// Parent
			await dialog.getByRole("textbox", { name: "Nom" }).fill("Fnac");
			await dialog.getByRole("spinbutton", { name: "Montant" }).fill("-60");
			await dialog.getByLabel("Date de la transaction").fill("2026-06-20");
			await dialog.getByRole("textbox", { name: "Commentaire" }).fill("Birthday gifts");
			await dialog.getByRole("checkbox", { name: "Transaction avec enfants" }).check();
			await dialog.getByRole("checkbox", { name: "Montrer commentaire & tags" }).check();
			// Children
			const children = [
				{ name: "Vinyl", amount: "-30", category: "Hobbies > Music", tag: "Food\\Miam", comment: "For Alice" },
				{ name: "Novel", amount: "-20", category: "Hobbies > Book", tag: "Food\\Drink", comment: "For Bob" },
				{ name: "Snacks", amount: "-10", category: "Food", tag: "Food\\Miam", comment: "For me" },
			];
			for (const [i, child] of children.entries()) {
				await dialog.getByRole("button", { name: "Ajouter un enfant" }).click();
				await dialog.locator(`input[name="children.${i}.name"]`).fill(child.name);
				await dialog.locator(`input[name="children.${i}.amount"]`).fill(child.amount);
				await dialog.locator(`select[name="children.${i}.categoryId"]`).selectOption({ label: child.category });
				await dialog.locator(`select[name="children.${i}.paymentTypeId"]`).selectOption({ label: "Cash" });
				await dialog.locator(`textarea[name="children.${i}.comment"]`).fill(child.comment);
				// Tags are added by double clicking on them
				const tagList = dialog.getByRole("listbox", { name: "tags" }).nth(i);
				// The dialog body scrolls: make sure the list is fully displayed, or the double click can be lost
				await tagList.evaluate((el) => el.scrollIntoView({ block: "center" }));
				await tagList.getByRole("option", { name: child.tag }).dblclick();
				await expect(
					dialog
						.getByRole("cell")
						.filter({ hasText: /^tags:/ })
						.nth(i),
				).toContainText(child.tag);
			}
			await dialog.getByRole("button", { name: "Enregister" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			const row = transactionRow(page, "Fnac");
			await expect(row.getByRole("cell").nth(5)).toContainText("Hobbies > Music");
			await expect(row.getByRole("cell").nth(5)).toContainText("Hobbies > Book");
			await expect(row.getByRole("cell").nth(5)).toContainText("Food");
			await row.getByRole("button", { name: "Expand transaction" }).click();
			for (const child of children) {
				await expect(page.locator("tr[id^='transaction-']").filter({ hasText: child.name })).toBeVisible();
			}
			// Comments & tags of children aren't displayed in the list: check them in database
			const [parent] = await queryDb(
				`SELECT id, comment, date::text AS date, consideration_date::text AS "considerationDate" FROM money.transaction WHERE name = 'Fnac'`,
			);
			expect(parent.comment).toBe("Birthday gifts");
			// Changing the transaction date also changes the consideration date
			expect(parent.date).toBe("2026-06-20");
			expect(parent.considerationDate).toBe("2026-06-20");
			const dbChildren = await queryDb(
				`SELECT t.name, t.amount, t.comment, tag.name AS tag
				 FROM money.transaction t
				 JOIN money.transaction_tag tt ON tt.transaction_id = t.id
				 JOIN money.tag tag ON tag.id = tt.tag_id
				 WHERE t.parent_id = $1 ORDER BY t.id`,
				[parent.id],
			);
			expect(dbChildren.map((c: any) => [c.name, Number(c.amount), c.comment, c.tag])).toEqual(
				children.map((c) => [c.name, Number(c.amount), c.comment, c.tag]),
			);
		});
	});

	test.describe("Delete", () => {
		test.afterEach(resetDb);

		test("Delete a simple transaction", async ({ page }) => {
			await page.goto("/money/transactions/2026-06");
			await transactionRow(page, "Doctor").getByRole("button", { name: "Delete transaction" }).click();
			const dialog = page.getByRole("dialog", { name: "Confirmation de suppression" });
			await expect(dialog).toContainText("Doctor");
			await dialog.getByRole("button", { name: "Supprimer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(transactionRow(page, "Doctor")).not.toBeVisible();
			expect(await queryDb("SELECT id FROM money.transaction WHERE id = 2")).toHaveLength(0);
		});

		test("Delete a transaction with children", async ({ page }) => {
			await page.goto("/money/transactions/2026-06");
			await transactionRow(page, "Auchan").getByRole("button", { name: "Delete transaction" }).click();
			const dialog = page.getByRole("dialog", { name: "Confirmation de suppression" });
			await expect(dialog).toContainText("Auchan");
			await dialog.getByRole("button", { name: "Supprimer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(transactionRow(page, "Auchan")).not.toBeVisible();
			// Parent, children (4, 5) and the children tags must be gone from database
			expect(await queryDb("SELECT id FROM money.transaction WHERE id = 3 OR parent_id = 3")).toHaveLength(0);
			expect(await queryDb("SELECT * FROM money.transaction_tag WHERE transaction_id IN (3, 4, 5)")).toHaveLength(
				0,
			);
		});
	});
});
