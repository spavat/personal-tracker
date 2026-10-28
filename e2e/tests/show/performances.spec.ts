import type { Locator, Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { spectacles, places, artists, performances } = SEED.show;

function performanceRows(page: Page) {
	return page.locator("table.performances tbody tr");
}

function castingRows(page: Page) {
	return page.locator(".base_content table.casting tbody tr");
}

async function openPerformance(page: Page, id: number, spectacleName: string) {
	await page.goto(`/shows/performances/${id}`);
	await expect(page.getByRole("heading", { name: spectacleName })).toBeVisible();
}

async function openCastingModal(page: Page, buttonName: string) {
	await page.getByRole("button", { name: buttonName }).click();
	const dialog = page.getByRole("dialog", { name: "Casting de la représentation" });
	await expect(dialog).toBeVisible();
	return dialog;
}

// Footer row of the roles table: new role name, main, artist picker
async function addRole(dialog: Locator, role: string, artistSearch: string, artistItem: string) {
	const footer = dialog.locator("tfoot");
	await footer.locator('input[name="role"]').fill(role);
	await footer.locator(".artist-search-select input").fill(artistSearch);
	await dialog.locator(".artist-search-select-item", { hasText: artistItem }).click();
	await footer.getByRole("button", { name: "Ajouter" }).click();
}

test.describe("Shows - Performances", () => {
	test.afterEach(resetDb);

	test("list shows every performance by date", async ({ page }) => {
		await page.goto("/shows/performances");
		await expect(performanceRows(page)).toHaveCount(7);
		await expect(performanceRows(page).locator("td:nth-child(3)")).toHaveText([
			spectacles.miserablesParis.name,
			spectacles.miserablesLondres.name,
			spectacles.hamlet.name,
			spectacles.miserablesParis.name,
			spectacles.miserablesParis.name,
			spectacles.hamlet.name,
			spectacles.miserablesLondres.name,
		]);
		// Place name at the performance date
		await expect(performanceRows(page).first().locator("td").nth(3)).toHaveText(places.chatelet.formerName);
		await expect(performanceRows(page).first().locator("td").nth(5)).toHaveText("🎫 B7");

		// A canceled performance has no number
		const canceled = performanceRows(page).nth(3);
		await expect(canceled).toHaveClass(/canceled/);
		await expect(canceled.locator("td").first()).toHaveText("");
		await expect(performanceRows(page).nth(4).locator("td").first()).toHaveText("#4");
	});

	test("list links to the performance, spectacle and place", async ({ page }) => {
		await page.goto("/shows/performances");
		const row = performanceRows(page).nth(2);
		await row.getByRole("link", { name: "14/02/26" }).click();
		await expect(page).toHaveURL(`/shows/performances/${performances.hamlet2026}`);

		await page.goBack();
		await performanceRows(page).nth(2).getByRole("link", { name: spectacles.hamlet.name }).click();
		await expect(page).toHaveURL(`/shows/spectacles/${spectacles.hamlet.id}`);

		await page.goBack();
		await performanceRows(page).nth(2).getByRole("link", { name: places.comedie.name }).click();
		await expect(page).toHaveURL(`/shows/places/${places.comedie.id}`);
	});

	test("details page shows the performance and its casting", async ({ page }) => {
		await openPerformance(page, performances.paris2025, spectacles.miserablesParis.name);
		await expect(page.locator(".presentation .general")).toContainText(`Lieu : ${places.chatelet.formerName}`);
		await expect(page.locator(".presentation .general")).toContainText("Date : 20/03/25 à 20:00");
		await expect(page.locator(".presentation .stats")).toContainText("Place : 🎫 B7");

		await expect(castingRows(page)).toHaveCount(2);
		await expect(castingRows(page).first().locator("td")).toHaveText(["#1", "Fantine", artists.alice.name, ""]);
		await expect(page.getByText("Casting: complete")).toBeVisible();
		await expect(page.getByText("Origine: program")).toBeVisible();

		await castingRows(page).getByRole("link", { name: artists.bob.name }).click();
		await expect(page).toHaveURL(`/shows/artists/${artists.bob.id}`);
	});

	test("edit a performance", async ({ page }) => {
		await openPerformance(page, performances.hamletSept, spectacles.hamlet.name);
		await page.locator(".presentation").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier la représentation" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("combobox", { name: "Spectacle" })).toHaveValue(String(spectacles.hamlet.id));
		await expect(dialog.getByRole("textbox", { name: "Place" })).toHaveValue("F1");

		await dialog.getByLabel("Date").fill("2026-09-06T16:30");
		await dialog.getByRole("textbox", { name: "Place" }).fill("G2");
		await dialog.getByRole("combobox", { name: "Statut" }).selectOption({ label: "Inconnu" });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.locator(".presentation .general")).toContainText("Date : 06/09/26 à 16:30");
		await expect(page.locator(".presentation .stats")).toContainText("Place : 🎫 G2");
	});

	test("cancel a performance", async ({ page }) => {
		await openPerformance(page, performances.hamletSept, spectacles.hamlet.name);
		await page.locator(".presentation").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier la représentation" });
		await dialog.getByRole("checkbox", { name: "Annulé" }).check();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await page.goto("/shows/performances");
		await expect(performanceRows(page).nth(5)).toHaveClass(/canceled/);
	});

	test("add the casting of a performance", async ({ page }) => {
		await openPerformance(page, performances.hamletSept, spectacles.hamlet.name);
		await expect(page.getByText("Aucun casting")).toBeVisible();
		const dialog = await openCastingModal(page, "Ajouter le casting");
		// Hamlet has no model
		await expect(dialog.locator('select[name="model"]')).toHaveCount(0);
		await expect(dialog.getByText("Aucun rôle enregistré")).toBeVisible();

		await addRole(dialog, "Hamlet", "ali", artists.alice.name);
		await addRole(dialog, "Ophélie", "clai", artists.claire.name);
		await dialog.locator('input[name="roles.1.status"]').fill("remplaçante");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(castingRows(page)).toHaveCount(2);
		await expect(castingRows(page).nth(0).locator("td")).toHaveText(["#1", "Hamlet", artists.alice.name, ""]);
		await expect(castingRows(page).nth(1).locator("td")).toHaveText([
			"#2",
			"Ophélie",
			artists.claire.name,
			"remplaçante",
		]);
	});

	test("create an artist from the casting", async ({ page }) => {
		await openPerformance(page, performances.hamletSept, spectacles.hamlet.name);
		const dialog = await openCastingModal(page, "Ajouter le casting");
		await dialog.locator('tfoot input[name="role"]').fill("Hamlet");
		await dialog.locator("tfoot .artist-search-select input").fill("Denis Laurent");
		await dialog.getByText("Créer l'artiste « Denis Laurent »").click();
		await expect(dialog.locator("tfoot .artist-search-select input")).toHaveValue("Denis Laurent");
		await dialog.locator("tfoot").getByRole("button", { name: "Ajouter" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(castingRows(page).first()).toContainText("Denis Laurent");
		await page.goto("/shows/artists");
		await expect(page.locator("table.artists tbody tr")).toHaveCount(4);
	});

	test("edit the casting: apply the model and remove a role", async ({ page }) => {
		await openPerformance(page, performances.paris2026, spectacles.miserablesParis.name);
		await expect(castingRows(page)).toHaveCount(1);
		const dialog = await openCastingModal(page, "Editer le casting");
		const roleRows = dialog.locator("tbody tr");
		await expect(roleRows).toHaveCount(1);

		await dialog.locator('select[name="model"]').selectOption({ label: "Distribution 2026" });
		await expect(roleRows).toHaveCount(2);
		await expect(dialog.locator('input[name="roles.0.name"]')).toHaveValue("Fantine");
		await expect(dialog.locator('input[name="roles.1.name"]')).toHaveValue("Javert");
		// The model has no artist for Javert
		await expect(roleRows.nth(1).locator(".artist-search-select input")).toHaveValue("");
		await roleRows.nth(1).locator(".artist-search-select input").fill("bob");
		await dialog.locator(".artist-search-select-item", { hasText: artists.bob.name }).click();

		await roleRows.nth(0).getByRole("button", { name: "Supprimer" }).click();
		await expect(roleRows).toHaveCount(1);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(castingRows(page)).toHaveCount(1);
		await expect(castingRows(page).first().locator("td")).toHaveText(["#1", "Javert", artists.bob.name, ""]);
	});

	test("search with ctrl+shift+f", async ({ page }) => {
		await page.goto("/shows/performances");
		await expect(performanceRows(page).first()).toBeVisible();
		await page.keyboard.press("Control+Shift+F");
		const search = page.getByPlaceholder("Recherche");
		await expect(search).toBeFocused();

		await search.fill("hamlet");
		await expect(page.locator(".search .result-item")).toHaveCount(1);
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(`/shows/spectacles/${spectacles.hamlet.id}`);

		await page.keyboard.press("Control+Shift+F");
		await search.fill("bob");
		await page.locator(".search .result-item", { hasText: artists.bob.name }).click();
		await expect(page).toHaveURL(`/shows/artists/${artists.bob.id}`);

		await page.keyboard.press("Control+Shift+F");
		await search.fill("sondheim");
		await page.locator(".search .result-item", { hasText: places.sondheim.name }).click();
		await expect(page).toHaveURL(`/shows/places/${places.sondheim.id}`);
	});
});
