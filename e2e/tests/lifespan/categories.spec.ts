import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { informatique, peripheriques, cuisine, vide } = SEED.lifespan.categories;

function rows(page: Page) {
	return page.locator("table.list tbody tr");
}

function row(page: Page, name: string) {
	return rows(page).filter({ has: page.locator("td:first-child").getByText(name, { exact: true }) });
}

async function openEditModal(page: Page, name: string) {
	await page.goto("/lifespan/categories");
	await row(page, name).getByRole("button", { name: "Modifier" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier la catégorie" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function openDeleteModal(page: Page, name: string) {
	await page.goto("/lifespan/categories");
	await row(page, name).getByRole("button", { name: "Supprimer" }).click();
	const dialog = page.getByRole("dialog", { name: "Supprimer la catégorie" });
	await expect(dialog).toContainText(`Êtes-vous sûr de vouloir supprimer la catégorie ${name} ?`);
	return dialog;
}

test.describe("Lifespan - Categories", () => {
	test.afterEach(resetDb);

	test("list shows the categories and their parent, by name", async ({ page }) => {
		await page.goto("/lifespan/categories");
		await expect(rows(page).locator("td:nth-child(1)")).toHaveText([
			cuisine.name,
			informatique.name,
			peripheriques.name,
			vide.name,
		]);
		await expect(row(page, peripheriques.name).locator("td").nth(1)).toHaveText(informatique.name);
		await expect(row(page, cuisine.name).locator("td").nth(1)).toHaveText("—");
	});

	test("add a category", async ({ page }) => {
		await page.goto("/lifespan/categories");
		await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une catégorie" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Électroménager");
		await dialog.getByRole("combobox", { name: "Catégorie parente" }).selectOption({ label: cuisine.name });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row(page, "Électroménager").locator("td").nth(1)).toHaveText(cuisine.name);
		await expect(rows(page).locator("td:nth-child(1)")).toHaveText([
			cuisine.name,
			"Électroménager",
			informatique.name,
			peripheriques.name,
			vide.name,
		]);
	});

	test("the form shows the missing name", async ({ page }) => {
		await page.goto("/lifespan/categories");
		await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une catégorie" });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
	});

	test("edit a category", async ({ page }) => {
		const dialog = await openEditModal(page, vide.name);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Divers");
		await dialog.getByRole("combobox", { name: "Catégorie parente" }).selectOption({ label: informatique.name });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row(page, vide.name)).toHaveCount(0);
		await expect(row(page, "Divers").locator("td").nth(1)).toHaveText(informatique.name);
	});

	test("remove the parent of a category", async ({ page }) => {
		const dialog = await openEditModal(page, peripheriques.name);
		await expect(dialog.getByRole("combobox", { name: "Catégorie parente" })).toHaveValue(informatique.id);
		await dialog.getByRole("combobox", { name: "Catégorie parente" }).selectOption("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row(page, peripheriques.name).locator("td").nth(1)).toHaveText("—");
	});

	test("a category can't be under itself nor its sub-categories", async ({ page }) => {
		const dialog = await openEditModal(page, informatique.name);
		await expect(dialog.getByRole("combobox", { name: "Catégorie parente" }).locator("option")).toHaveText([
			"",
			cuisine.name,
			vide.name,
		]);
	});

	test("a category with sub-categories can't be deleted", async ({ page }) => {
		const dialog = await openDeleteModal(page, informatique.name);
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).toContainText(
			"Cette catégorie a des sous-catégories. Supprimez-les ou déplacez-les avant de continuer.",
		);
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(rows(page)).toHaveCount(4);
	});

	test("a category with objects can't be deleted", async ({ page }) => {
		const dialog = await openDeleteModal(page, cuisine.name);
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).toContainText(
			"Des objets sont encore rattachés à cette catégorie. Déplacez-les avant de continuer.",
		);
	});

	test("delete a category", async ({ page }) => {
		const dialog = await openDeleteModal(page, vide.name);
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(row(page, vide.name)).toHaveCount(0);
		await expect(rows(page)).toHaveCount(3);
	});
});
