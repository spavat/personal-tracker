import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { places, spectacles } = SEED.show;

function placeRows(page: Page) {
	return page.locator("table.places tbody tr");
}

function placeNames(page: Page) {
	return placeRows(page).locator("td:nth-child(2)");
}

function placeRow(page: Page, name: string) {
	return placeRows(page).filter({ hasText: name });
}

function performanceRows(page: Page) {
	// Group title rows have a single cell
	return page.locator("table.performances tbody tr").filter({ has: page.locator("td:nth-child(2)") });
}

async function openPlace(page: Page, place: { id: number; name: string }) {
	await page.goto(`/shows/places/${place.id}`);
	await expect(page.getByRole("heading", { name: place.name })).toBeVisible();
}

test.describe("Shows - Places", () => {
	test.afterEach(resetDb);

	test("list shows the places sorted by name", async ({ page }) => {
		await page.goto("/shows/places");
		await expect(placeNames(page)).toHaveText([
			places.comedie.name,
			places.empty.name,
			places.sondheim.name,
			places.chatelet.name,
		]);
		await expect(placeRow(page, places.sondheim.name).locator(".fi-gb")).toBeAttached();
		// Canceled performances aren't counted, as in the details page
		await expect(placeRow(page, places.chatelet.name).locator("td").nth(4)).toHaveText("2");
	});

	test("sort the list by name", async ({ page }) => {
		await page.goto("/shows/places");
		await page.getByRole("columnheader", { name: "Nom" }).getByText("Nom").click();
		await expect(placeNames(page)).toHaveText([
			places.chatelet.name,
			places.sondheim.name,
			places.empty.name,
			places.comedie.name,
		]);
	});

	test("a place with performances can't be deleted", async ({ page }) => {
		await page.goto("/shows/places");
		await expect(placeRow(page, places.chatelet.name).getByRole("button", { name: "Supprimer" })).toBeDisabled();
		await expect(placeRow(page, places.empty.name).getByRole("button", { name: "Supprimer" })).toBeEnabled();
	});

	test("delete a place", async ({ page }) => {
		await page.goto("/shows/places");
		await placeRow(page, places.empty.name).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer lieu" });
		await expect(dialog).toContainText(`Nom : ${places.empty.name}`);
		await dialog.getByRole("button", { name: "Supprimer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(placeRows(page)).toHaveCount(3);
	});

	test("details page shows the place and its performances", async ({ page }) => {
		await openPlace(page, places.chatelet);
		const general = page.locator(".presentation .general");
		await expect(general).toContainText(`${places.chatelet.formerName} (avant le 01/06/25)`);
		await expect(general).toContainText("1 place du Châtelet, Paris");
		await expect(general.getByRole("link", { name: "https://www.chatelet.com" })).toBeVisible();
		await expect(page.locator(".presentation .stats")).toContainText("2 représentations");
		await expect(page.locator(".presentation .stats")).toContainText("(10/04/26)");

		// Name at the performance date
		await expect(performanceRows(page).locator("td:nth-child(4)")).toHaveText([
			places.chatelet.formerName,
			places.chatelet.name,
			places.chatelet.name,
		]);

		await page.getByRole("checkbox", { name: "Grouper par spectacle" }).check();
		await expect(page.locator("table.performances .title")).toHaveText([spectacles.miserablesParis.name]);
	});

	test("details page of a place without performance", async ({ page }) => {
		await openPlace(page, places.empty);
		await expect(page.locator(".presentation .stats")).toContainText("Dernière fois : Aucune");
		await expect(performanceRows(page)).toHaveCount(0);
	});

	test("add a place", async ({ page }) => {
		await page.goto("/shows/places");
		await page.getByRole("button", { name: "Ajouter un lieu" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un lieu" });
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Opéra Garnier");
		await dialog.getByRole("textbox", { name: "Adresse" }).fill("Place de l'Opéra, Paris");
		await dialog.getByRole("textbox", { name: "Pays" }).fill("fr");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(placeNames(page)).toHaveText([
			places.comedie.name,
			"Opéra Garnier",
			places.empty.name,
			places.sondheim.name,
			places.chatelet.name,
		]);
	});

	test("rename a place and keep its former name", async ({ page }) => {
		await openPlace(page, places.sondheim);
		await page.locator(".presentation").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le lieu" });
		await expect(dialog.getByRole("textbox", { name: "Nom *" })).toHaveValue(places.sondheim.name);

		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Sondheim Theatre London");
		await dialog.getByRole("button", { name: "Ajouter un ancien nom" }).click();
		await dialog.getByPlaceholder("Nom").fill("Queen's Theatre");
		await dialog.getByLabel("jusqu'au (exclu)").fill("2026-01-01");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Sondheim Theatre London" })).toBeVisible();
		await expect(page.locator(".presentation .general")).toContainText("Queen's Theatre (avant le 01/01/26)");
		await expect(performanceRows(page).locator("td:nth-child(4)")).toHaveText([
			"Queen's Theatre",
			"Sondheim Theatre London",
		]);
	});

	test("remove a former name", async ({ page }) => {
		await openPlace(page, places.chatelet);
		await page.locator(".presentation").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le lieu" });
		await expect(dialog.getByPlaceholder("Nom")).toHaveValue(places.chatelet.formerName);
		await dialog.locator(".full-fields-row").getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.locator(".presentation .general")).not.toContainText(places.chatelet.formerName);
		await expect(performanceRows(page).first().locator("td").nth(3)).toHaveText(places.chatelet.name);
	});

	test("the place form shows its errors", async ({ page }) => {
		await page.goto("/shows/places");
		await page.getByRole("button", { name: "Ajouter un lieu" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un lieu" });
		await dialog.getByRole("textbox", { name: "Site" }).fill("not an url");
		await dialog.getByRole("button", { name: "Ajouter un ancien nom" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await expect(dialog.getByText("URL invalide")).toBeVisible();
		await expect(dialog.getByText("Le nom et la date sont obligatoires")).toBeVisible();

		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Opéra Garnier");
		await dialog.getByRole("textbox", { name: "Site" }).fill("https://www.operadeparis.fr");
		await dialog.locator(".full-fields-row").getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(placeRows(page)).toHaveCount(5);
	});
});
