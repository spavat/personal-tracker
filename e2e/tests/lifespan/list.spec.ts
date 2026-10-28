import type { Locator, Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { souris, clavier, laptop, cafetiere } = SEED.lifespan.objects;

function objectRows(page: Page) {
	return page.locator("table.objects > tbody > tr").filter({ has: page.locator("td:nth-child(7)") });
}

function objectRow(page: Page, name: string) {
	return objectRows(page).filter({ has: page.locator("td:nth-child(2)", { hasText: name }) });
}

function eventRows(page: Page) {
	return page.locator("table.events tbody tr");
}

function eventRow(page: Page, type: string) {
	return eventRows(page).filter({ has: page.getByRole("cell", { name: type, exact: true }) });
}

async function expand(page: Page, name: string) {
	await page.goto("/lifespan/list");
	await objectRow(page, name).getByRole("button", { name: "Afficher les évènements" }).click();
	await expect(page.locator("table.events")).toBeVisible();
}

async function openObjectModal(page: Page, name?: string) {
	await page.goto("/lifespan/list");
	if (name) {
		await objectRow(page, name).getByRole("button", { name: "Modifier" }).click();
	} else {
		await page.getByRole("button", { name: "Ajouter un objet" }).click();
	}
	const dialog = page.getByRole("dialog", { name: name ? "Modifier l'objet" : "Ajouter un objet" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function fillEvent(dialog: Locator, index: number, type: string, date: string, cause?: string) {
	await dialog.locator(`select[name="events.${index}.type"]`).selectOption({ label: type });
	await dialog.locator(`input[name="events.${index}.date"]`).fill(date);
	if (cause) await dialog.locator(`select[name="events.${index}.cause"]`).selectOption({ label: cause });
}

test.describe("Lifespan - Objects list", () => {
	test.afterEach(resetDb);

	test("list shows the objects and their status, by name", async ({ page }) => {
		await page.goto("/lifespan/list");
		await expect(objectRows(page).locator("td:nth-child(2)")).toHaveText([
			cafetiere.name,
			clavier.name,
			`${laptop.name}Portable perso`,
			souris.name,
		]);
		await expect(objectRow(page, clavier.name).locator("td")).toHaveText([
			"",
			clavier.name,
			"Périphériques",
			"clavier",
			"Utilisation terminée",
			"Sorti",
			" ",
		]);
		await expect(objectRow(page, laptop.name).locator("td").nth(4)).toHaveText("En pause");
		await expect(objectRow(page, souris.name).locator("td").nth(4)).toHaveText("En cours");
		await expect(objectRow(page, cafetiere.name).locator("td").nth(3)).toHaveText("—");
		await expect(objectRow(page, cafetiere.name).locator("td").nth(4)).toHaveText("Pas encore utilisé");
	});

	test("sort the list by status", async ({ page }) => {
		await page.goto("/lifespan/list");
		await page.getByRole("columnheader", { name: "Statut" }).getByText("Statut").click();
		await expect(objectRows(page).locator("td:nth-child(5)")).toHaveText([
			"Utilisation terminée",
			"En cours",
			"Pas encore utilisé",
			"En pause",
		]);
	});

	test("a row shows its events, newest first", async ({ page }) => {
		await expand(page, clavier.name);
		await expect(eventRows(page).locator("td:nth-child(1)")).toHaveText([
			"Sortie",
			"Fin d'utilisation",
			"Début d'utilisation",
			"Achat",
		]);
		await expect(eventRow(page, "Sortie").locator("td").nth(1)).toHaveText("01/03/2025");
		await expect(eventRow(page, "Sortie").locator(".badge")).toHaveText("Donné");
		await expect(eventRow(page, "Sortie").locator("td").nth(2)).toHaveText("DonnéDonné à Paul");

		await objectRow(page, cafetiere.name).getByRole("button", { name: "Afficher les évènements" }).click();
		await expect(eventRows(page).locator("td:nth-child(1)")).toHaveText(["Achat"]);
	});

	test("add an object with its events", async ({ page }) => {
		const dialog = await openObjectModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Écran 27");
		await dialog.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Périphériques" });
		await dialog.getByRole("textbox", { name: "Type" }).fill("écran");
		await dialog.getByRole("textbox", { name: "Description" }).fill("Écran du bureau");
		await dialog.getByRole("button", { name: "Ajouter un évènement" }).click();
		await fillEvent(dialog, 0, "Achat", "2026-09-01");
		await dialog.getByRole("button", { name: "Ajouter un évènement" }).click();
		await fillEvent(dialog, 1, "Sortie", "2026-10-20", "Vendu");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(objectRow(page, "Écran 27").locator("td")).toHaveText([
			"",
			"Écran 27Écran du bureau",
			"Périphériques",
			"écran",
			"Utilisation terminée",
			"Sorti",
			" ",
		]);
		await objectRow(page, "Écran 27").getByRole("button", { name: "Afficher les évènements" }).click();
		await expect(eventRows(page).locator("td:nth-child(3)")).toHaveText(["Vendu", ""]);
	});

	test("the object form shows the missing fields", async ({ page }) => {
		const dialog = await openObjectModal(page);
		await dialog.getByRole("button", { name: "Ajouter un évènement" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await expect(dialog.getByText("La catégorie est obligatoire")).toBeVisible();
		await expect(dialog.getByText("Le type et la date de chaque évènement sont obligatoires")).toBeVisible();
	});

	test("edit an object and its events", async ({ page }) => {
		const dialog = await openObjectModal(page, laptop.name);
		await expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue("Portable perso");
		// Chronological in the form
		await expect(dialog.locator('select[name="events.0.type"]')).toHaveValue("received");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Laptop pro");
		await dialog.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Périphériques" });
		await dialog.locator(".full-fields-row").first().getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(objectRow(page, "Laptop pro").locator("td").nth(2)).toHaveText("Périphériques");
		await objectRow(page, "Laptop pro").getByRole("button", { name: "Afficher les évènements" }).click();
		await expect(eventRows(page).locator("td:nth-child(1)")).toHaveText(["Pause", "Début d'utilisation"]);
	});

	test("remove the description of an object", async ({ page }) => {
		const dialog = await openObjectModal(page, laptop.name);
		await dialog.getByRole("textbox", { name: "Description" }).fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await page.reload();
		await expect(objectRow(page, laptop.name).locator("td").nth(1)).toHaveText(laptop.name);
	});

	test("edit an event", async ({ page }) => {
		await expand(page, souris.name);
		await eventRow(page, "Début d'utilisation").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'évènement" });
		await expect(dialog.getByLabel("Date")).toHaveValue("2023-02-05");
		await dialog.getByLabel("Date").fill("2023-02-06");
		await dialog.getByRole("textbox", { name: "Commentaire" }).fill("Au bureau");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(eventRow(page, "Début d'utilisation").locator("td")).toHaveText([
			"Début d'utilisation",
			"06/02/2023",
			"Au bureau",
			" ",
		]);
	});

	test("turn a disposal into a note", async ({ page }) => {
		await expand(page, clavier.name);
		await eventRow(page, "Sortie").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'évènement" });
		await expect(dialog.getByRole("combobox", { name: "Cause" })).toHaveValue("given_away");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption({ label: "Note" });
		await dialog.getByRole("textbox", { name: "Commentaire" }).fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await page.reload();
		await expect(objectRow(page, clavier.name).locator("td").nth(5)).toHaveText("Possédé");
		await objectRow(page, clavier.name).getByRole("button", { name: "Afficher les évènements" }).click();
		// No cause nor comment left
		await expect(eventRow(page, "Note").locator("td").nth(2)).toHaveText("");
	});

	test("the event form shows the missing fields", async ({ page }) => {
		await expand(page, souris.name);
		await eventRow(page, "Achat").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'évènement" });
		await dialog.getByRole("combobox", { name: "Type" }).selectOption({ label: "Sortie" });
		await dialog.getByLabel("Date").fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("La date est obligatoire")).toBeVisible();
		await expect(dialog.getByText("La cause est obligatoire")).toBeVisible();
	});

	test("delete an event", async ({ page }) => {
		await expand(page, souris.name);
		await eventRow(page, "Début d'utilisation").getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer l'évènement" });
		await expect(dialog).toContainText(
			"Êtes-vous sûr de vouloir supprimer l'évènement Début d'utilisation du 05/02/2023 ?",
		);
		await dialog.getByRole("button", { name: "Supprimer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(eventRows(page).locator("td:nth-child(1)")).toHaveText(["Achat"]);
		await expect(objectRow(page, souris.name).locator("td").nth(4)).toHaveText("Pas encore utilisé");
	});

	test("delete an object", async ({ page }) => {
		await page.goto("/lifespan/list");
		await objectRow(page, cafetiere.name).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer l'objet" });
		await expect(dialog).toContainText(
			`Êtes-vous sûr de vouloir supprimer ${cafetiere.name} et tout son historique ?`,
		);

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(objectRows(page)).toHaveCount(4);

		await objectRow(page, cafetiere.name).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(objectRows(page)).toHaveCount(3);
		await expect(objectRow(page, cafetiere.name)).toHaveCount(0);
	});
});
