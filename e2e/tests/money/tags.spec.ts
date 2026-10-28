import type { Page } from "@playwright/test";

import { expect, test, resetDb } from "../../fixtures";

async function addTag(page: Page, name: string) {
	await page.getByRole("button", { name: "Ajouter un tag" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter un tag" });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("textbox", { name: "Nom" }).fill(name);
	await dialog.getByRole("textbox", { name: "Icône" }).fill("fas fa-tag");
	await dialog.getByLabel("Couleur du fond").fill("#a0db28");
	await dialog.getByLabel("Couleur du texte").fill("#000000");
	await dialog.getByRole("button", { name: "Enregistrer" }).click();
	await expect(dialog).not.toBeVisible();
}

test.describe("Tags", () => {
	test.afterEach(resetDb);

	test("tags page loads", async ({ page }) => {
		await page.goto("/money/tags");
		await expect(page.getByRole("heading", { name: /Liste des tags \(\d+\)/ })).toBeVisible();
		await expect(page.getByRole("table").getByRole("row")).toHaveCount(3); // 2 data rows + 1 header row
		await expect(page.getByRole("link", { name: "Food\\Miam", exact: true })).toBeVisible();
		await expect(page.getByRole("link", { name: "Food\\Drink", exact: true })).toBeVisible();
	});

	test("tag link goes to the list of transactions for that tag", async ({ page }) => {
		await page.goto("/money/tags");
		await expect(page.getByRole("heading", { name: /Liste des tags \(\d+\)/ })).toBeVisible();
		await expect(page.getByRole("link", { name: "Food\\Miam", exact: true })).toBeVisible();
		page.getByRole("link", { name: "Food\\Miam", exact: true }).click();
		await expect(page).toHaveURL("/money/transactions/tag/1");
	});

	test("add a tag", async ({ page }) => {
		await page.goto("/money/tags");
		const rows = page.getByRole("table").getByRole("row");
		await expect(rows.first()).toBeVisible();
		const initialCount = await rows.count();

		await addTag(page, "Holidays");
		// Assertion
		await expect(rows).toHaveCount(initialCount + 1);
		await expect(page.getByRole("link", { name: "Holidays", exact: true })).toBeVisible();
	});

	test("cannot delete a tag used by transactions", async ({ page }) => {
		await page.goto("/money/tags");
		const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Food\\Miam", exact: true }) });
		await row.getByRole("button", { name: "Supprimer" }).click();
		// Assert modal
		const dialog = page.getByRole("dialog", { name: 'Supprimer le tag "Food\\Miam"' });
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText("3 trouvées");
		await expect(dialog.getByRole("button", { name: "Supprimer le tag" })).toBeDisabled();
	});

	test("delete a tag", async ({ page }) => {
		// Seeded tags are all used by transactions, so they can't be deleted: create a fresh one
		await page.goto("/money/tags");
		await addTag(page, "Temporary");
		const rows = page.getByRole("table").getByRole("row");
		const row = rows.filter({ has: page.getByRole("link", { name: "Temporary", exact: true }) });
		await expect(row).toBeVisible();
		const initialCount = await rows.count();

		await row.getByRole("button", { name: "Supprimer" }).click();
		// Assert modal
		const dialog = page.getByRole("dialog", { name: 'Supprimer le tag "Temporary"' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Supprimer le tag" }).click();
		// Assertion
		await expect(dialog).not.toBeVisible();
		await expect(rows).toHaveCount(initialCount - 1);
		await expect(page.getByRole("link", { name: "Temporary", exact: true })).not.toBeVisible();
	});

	test("update a tag", async ({ page }) => {
		await page.goto("/money/tags");
		const rows = page.getByRole("table").getByRole("row");
		await expect(rows.first()).toBeVisible();
		const initialCount = await rows.count();

		const row = rows.filter({ has: page.getByRole("link", { name: "Food\\Drink", exact: true }) });
		await row.getByRole("button", { name: "Modifier" }).click();
		// Assert modal
		const dialog = page.getByRole("dialog", { name: "Modifier le tag" });
		await expect(dialog).toBeVisible();
		// Wait for the form to be prefilled before editing
		const nameInput = dialog.getByRole("textbox", { name: "Nom" });
		await expect(nameInput).toHaveValue("Food\\Drink");
		await nameInput.fill("Food\\Coffee");
		await dialog.getByRole("textbox", { name: "Icône" }).fill("fas fa-mug-hot");
		await dialog.getByLabel("Couleur du fond").fill("#40d1aa");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		// Assertion
		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("link", { name: "Food\\Coffee", exact: true })).toBeVisible();
		await expect(page.getByRole("link", { name: "Food\\Drink", exact: true })).not.toBeVisible();
		await expect(rows).toHaveCount(initialCount);
	});
});
