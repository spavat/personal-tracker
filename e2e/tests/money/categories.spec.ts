import { expect, test, resetDb } from "../../fixtures";

test.describe("Categories", () => {
	test.afterEach(resetDb);
	test("categories page loads", async ({ page }) => {
		await page.goto("/money/categories");
		await expect(page.getByRole("heading", { name: /Liste des catégories \(\d+\)/ })).toBeVisible();
		await expect(page.getByRole("table").getByRole("row")).toHaveCount(7); // 6 data rows + 1 header row
		await expect(page.getByRole("link", { name: "Food", exact: true })).toBeVisible();
	});

	test("category link goes to the list of transactions for that category", async ({ page }) => {
		await page.goto("/money/categories");
		await expect(page.getByRole("heading", { name: /Liste des catégories \(\d+\)/ })).toBeVisible();
		await expect(page.getByRole("link", { name: "Food", exact: true })).toBeVisible();
		page.getByRole("link", { name: "Food", exact: true }).click();
		await expect(page).toHaveURL("/money/transactions/category/1");
	});

	test("add a category", async ({ page }) => {
		await page.goto("/money/categories");
		// Initial count of rows in the table
		const rows = page.getByRole("table").getByRole("row");
		await expect(rows.first()).toBeVisible();
		const initialCount = await rows.count();

		// Find and click the add button
		const addBtn = page.getByRole("button", { name: /ajout|add|\+/i }).first();
		await addBtn.click();
		// Assert modal
		await expect(page.getByRole("dialog", { name: "Ajouter une catégorie" })).toBeVisible();
		// Fill form
		const dialog = page.getByRole("dialog", { name: "Ajouter une catégorie" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Sport");
		await dialog.getByRole("textbox", { name: "Icône" }).fill("fas fa-running");
		await dialog.getByRole("textbox", { name: "Couleur du fond" }).fill("#a0db28");
		await dialog.getByRole("textbox", { name: "Couleur du texte" }).fill("#000000");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		// Assertion
		await expect(page.getByRole("dialog", { name: "Ajouter une catégorie" })).not.toBeVisible();
		await expect(rows).toHaveCount(initialCount + 1);
		await expect(page.getByRole("link", { name: "Sport", exact: true })).toBeVisible();
	});

	test("cannot delete a category used by transactions", async ({ page }) => {
		await page.goto("/money/categories");
		const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Health", exact: true }) });
		await row.getByRole("button", { name: "Supprimer" }).click();
		// Assert modal
		const dialog = page.getByRole("dialog", { name: 'Supprimer la catégorie "Health"' });
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText("2 trouvées");
		await expect(dialog.getByRole("button", { name: "Supprimer" })).toBeDisabled();
	});

	test("delete a category", async ({ page }) => {
		await page.goto("/money/categories");
		const rows = page.getByRole("table").getByRole("row");
		await expect(rows.first()).toBeVisible();
		const initialCount = await rows.count();

		const row = rows.filter({ has: page.getByRole("link", { name: "Transport", exact: true }) });
		await row.getByRole("button", { name: "Supprimer" }).click();
		// Assert modal
		const dialog = page.getByRole("dialog", { name: 'Supprimer la catégorie "Transport"' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await page.pause();
		// Assertion
		await expect(dialog).not.toBeVisible();
		await expect(rows).toHaveCount(initialCount - 1);
		await expect(page.getByRole("link", { name: "Transport", exact: true })).not.toBeVisible();
	});

	test("update a category", async ({ page }) => {
		await page.goto("/money/categories");

		// Initial count of rows in the table
		const rows = page.getByRole("table").getByRole("row");
		await expect(rows.first()).toBeVisible();
		const initialCount = await rows.count();

		const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Food", exact: true }) });
		await row.getByRole("button", { name: "Modifier" }).click();
		// Assert modal
		const dialog = page.getByRole("dialog", { name: "Modifier la catégorie" });
		await expect(dialog).toBeVisible();
		// Wait for the form to be prefilled before editing
		const nameInput = dialog.getByRole("textbox", { name: "Nom" });
		await expect(nameInput).toHaveValue("Food");
		await nameInput.fill("Restaurants");
		await dialog.getByRole("textbox", { name: "Icône" }).fill("fas fa-pizza-slice");
		await dialog.getByRole("textbox", { name: "Couleur du fond" }).fill("#40d1aa");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		// Assertion
		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("link", { name: "Restaurants", exact: true })).toBeVisible();
		await expect(page.getByRole("link", { name: "Food", exact: true })).not.toBeVisible();
		await expect(rows).toHaveCount(initialCount);
	});
});
