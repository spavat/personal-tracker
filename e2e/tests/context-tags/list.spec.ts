import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { transport, lieu, ecoute } = SEED.contextTags;

function rows(page: Page) {
	return page.locator("table.list tbody tr");
}

function row(page: Page, name: string) {
	return rows(page).filter({ has: page.getByRole("cell", { name, exact: true }) });
}

function tagInput(page: Page, index: number) {
	return page.getByRole("dialog").locator(`input[name="tags.${index}.value"]`);
}

async function openAddModal(page: Page) {
	await page.goto("/context-tags");
	await page.getByRole("button", { name: "Ajouter un tag principal" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter un tag principal" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function openEditModal(page: Page, name: string) {
	await page.goto("/context-tags");
	await row(page, name).getByRole("button", { name: "Modifier" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier le tag principal" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Context tags", () => {
	test.afterEach(resetDb);

	test("list shows the main tags and their tags, by name", async ({ page }) => {
		await page.goto("/context-tags");
		await expect(rows(page).locator("td:nth-child(1)")).toHaveText([ecoute.name, lieu.name, transport.name]);
		await expect(row(page, transport.name).locator(".badge")).toHaveText(["train", "voiture", "vélo"]);
		await expect(row(page, ecoute.name).locator(".badge")).toHaveText(["casque"]);
	});

	test("add a main tag", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Humeur");
		await tagInput(page, 0).fill("calme");
		await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
		await tagInput(page, 1).fill("énergique");
		// An empty tag is ignored
		await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row(page, "Humeur").locator(".badge")).toHaveText(["calme", "énergique"]);
		await page.reload();
		await expect(row(page, "Humeur").locator(".badge")).toHaveText(["calme", "énergique"]);
	});

	test("cancel the add form", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Brouillon");
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(rows(page)).toHaveCount(3);

		await page.getByRole("button", { name: "Ajouter un tag principal" }).click();
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue("");
	});

	test("the form shows the missing name", async ({ page }) => {
		const dialog = await openAddModal(page);
		await tagInput(page, 0).fill("calme");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
	});

	test("the form refuses a tag given twice", async ({ page }) => {
		const dialog = await openEditModal(page, lieu.name);
		await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
		await tagInput(page, 2).fill("maison");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Ce tag est en double")).toBeVisible();
	});

	test("edit a main tag", async ({ page }) => {
		const dialog = await openEditModal(page, transport.name);
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue(transport.name);
		await expect(tagInput(page, 2)).toHaveValue("vélo");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Trajet");
		// Remove "voiture", add "bus"
		await dialog.locator(".full-fields-row").nth(1).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
		await tagInput(page, 2).fill("bus");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row(page, transport.name)).toHaveCount(0);
		await expect(row(page, "Trajet").locator(".badge")).toHaveText(["train", "vélo", "bus"]);
		await page.reload();
		await expect(row(page, "Trajet").locator(".badge")).toHaveText(["train", "vélo", "bus"]);
	});

	test("remove all the tags of a main tag", async ({ page }) => {
		const dialog = await openEditModal(page, lieu.name);
		await dialog.locator(".full-fields-row").nth(1).getByRole("button", { name: "Supprimer" }).click();
		// The last row can't be removed, only emptied
		await expect(dialog.locator(".full-fields-row").getByRole("button", { name: "Supprimer" })).toHaveCount(0);
		await tagInput(page, 0).fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await page.reload();
		await expect(row(page, lieu.name).locator(".badge")).toHaveCount(0);
	});

	test("delete a main tag", async ({ page }) => {
		await page.goto("/context-tags");
		await row(page, lieu.name).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer le tag principal" });
		await expect(dialog).toContainText(`Êtes-vous sûr de vouloir supprimer le tag principal ${lieu.name} ?`);

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(rows(page)).toHaveCount(3);

		await row(page, lieu.name).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(rows(page).locator("td:nth-child(1)")).toHaveText([ecoute.name, transport.name]);
	});

	test("an empty list", async ({ page }) => {
		await page.goto("/context-tags");
		for (const name of [transport.name, lieu.name, ecoute.name]) {
			await row(page, name).getByRole("button", { name: "Supprimer" }).click();
			await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
			await expect(row(page, name)).toHaveCount(0);
		}
		await expect(rows(page)).toHaveText(["Aucun tag."]);
	});

	test("an unknown main tag can't be edited nor deleted", async ({ page }) => {
		for (const action of ["edit", "delete"]) {
			await page.goto(`/context-tags/${action}/00000000-0000-4000-8000-000000000000?returnTo=/context-tags`);
			const dialog = page.getByRole("dialog", { name: "Erreur" });
			await expect(dialog).toContainText("Tag principal introuvable");
		}
	});
});
