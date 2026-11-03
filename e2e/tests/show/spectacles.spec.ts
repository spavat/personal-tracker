import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { spectacles, places, artists } = SEED.show;

function spectacleRows(page: Page) {
	// Group title rows have a single cell
	return page.locator("table.spectacles tbody tr").filter({ has: page.locator("td:nth-child(2)") });
}

function groupTitles(page: Page) {
	return page.locator("table.spectacles tbody tr td[colspan]");
}

function performanceRows(page: Page) {
	return page.locator("table.performances tbody tr").filter({ has: page.locator("td:nth-child(3)") });
}

async function openSpectacle(page: Page, spectacle: { id: number; name: string }) {
	await page.goto(`/shows/spectacles/${spectacle.id}`);
	await expect(page.getByRole("heading", { name: spectacle.name, exact: true })).toBeVisible();
}

async function openAddPerformance(page: Page) {
	await page.getByRole("button", { name: "Ajouter une représentation" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Shows - Spectacles", () => {
	test.afterEach(resetDb);

	test("list shows all the spectacles", async ({ page }) => {
		await page.goto("/shows/spectacles");
		await expect(groupTitles(page)).toHaveText(["Années 2025 - 2027 (3 spectacles - 6 représentations)"]);
		await expect(spectacleRows(page).locator("td:nth-child(2)")).toHaveText([
			spectacles.miserablesParis.name,
			spectacles.miserablesLondres.name,
			spectacles.hamlet.name,
		]);
		const paris = spectacleRows(page).first();
		await expect(paris.locator("td").nth(2)).toHaveText("2");
		// One line per place name: before and after the rename
		await expect(paris.locator("td").nth(3).getByRole("link")).toHaveText([
			places.chatelet.formerName,
			places.chatelet.name,
		]);
		await expect(paris.locator("td").nth(4).locator(".canceled")).toHaveText("21/02/26 ");
		await expect(spectacleRows(page).nth(1).locator("td").nth(4)).toContainText("📅15/01/27");
	});

	test("group the list by year", async ({ page }) => {
		await page.goto("/shows/spectacles");
		await page.getByRole("checkbox", { name: "Grouper par année" }).check();
		await expect(groupTitles(page)).toHaveText([
			"Année 2027 (1 spectacles - 1 représentations)",
			"Année 2026 (2 spectacles - 3 représentations)",
			"Année 2025 (2 spectacles - 2 représentations)",
		]);

		// Stored: still grouped after a reload
		await page.reload();
		await expect(page.getByRole("checkbox", { name: "Grouper par année" })).toBeChecked();
		await expect(groupTitles(page)).toHaveCount(3);
	});

	test("details page lists the performances and their cast", async ({ page }) => {
		await openSpectacle(page, spectacles.miserablesParis);
		await expect(page.getByRole("heading", { name: "Représentations (3)" })).toBeVisible();
		await expect(performanceRows(page)).toHaveCount(3);
		await expect(performanceRows(page).first().locator("td").nth(3)).toHaveText(places.chatelet.formerName);
		// The canceled performance has no number
		await expect(performanceRows(page).locator("td:first-child")).toHaveText(["#1", "", "#2"]);

		// The first cell toggles the cast row
		await performanceRows(page).first().locator("td").first().click();
		const castRow = page.locator("table.performances tbody tr").nth(1);
		await expect(castRow.locator("li")).toHaveText([
			`${artists.alice.name} - Fantine`,
			`${artists.bob.name} - Javert`,
		]);
		await performanceRows(page).first().locator("td").first().click();
		await expect(page.locator("table.performances li")).toHaveCount(0);
	});

	test("add a performance with an existing place", async ({ page }) => {
		await openSpectacle(page, spectacles.hamlet);
		const dialog = await openAddPerformance(page);
		await expect(dialog.getByRole("combobox", { name: "Spectacle" })).toHaveValue(String(spectacles.hamlet.id));
		await dialog.locator('select[name="performance.placeId"]').selectOption({ label: places.chatelet.name });
		await dialog.getByLabel("Date").fill("2026-11-20T20:00");
		await dialog.getByRole("textbox", { name: "Place" }).fill("R4");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Représentations (3)" })).toBeVisible();
		await expect(performanceRows(page).nth(2).locator("td").nth(3)).toHaveText(places.chatelet.name);
	});

	test("add a performance in a new place", async ({ page }) => {
		await openSpectacle(page, spectacles.hamlet);
		const dialog = await openAddPerformance(page);
		await dialog.locator(".panel", { hasText: "Lieu" }).getByRole("button", { name: "Ajouter" }).click();
		await expect(dialog.getByRole("heading", { name: "Nouveau lieu" })).toBeVisible();
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Globe Theatre");
		await dialog.getByRole("textbox", { name: "Adresse" }).fill("21 New Globe Walk, London");
		await dialog.getByRole("textbox", { name: "Pays" }).fill("gb");
		await dialog.getByLabel("Date").fill("2026-11-21T19:30");
		await dialog.getByRole("textbox", { name: "Place" }).fill("Y1");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(performanceRows(page).nth(2).locator("td").nth(3)).toHaveText("Globe Theatre");
		await page.goto("/shows/places");
		await expect(page.locator("table.places tbody tr")).toHaveCount(5);
	});

	test("add a model", async ({ page }) => {
		await openSpectacle(page, spectacles.hamlet);
		await page.getByRole("button", { name: "Ajouter un modèle" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un modèle" });
		await expect(dialog).toBeVisible();
		await dialog.getByRole("textbox", { name: "Nom*" }).fill("Création 2026");

		// A model needs at least one role
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("roles")).toBeVisible();

		const footer = dialog.locator("tfoot");
		await footer.locator('input[name="role"]').fill("Hamlet");
		await footer.locator('input[name="main"]').check();
		await footer.locator(".artist-search-select input").fill("ali");
		await dialog.locator(".artist-search-select-item", { hasText: artists.alice.name }).click();
		await footer.getByRole("button", { name: "Ajouter" }).click();
		// No artist needed in a model
		await footer.locator('input[name="role"]').fill("Ophélie");
		await footer.getByRole("button", { name: "Ajouter" }).click();
		await expect(dialog.locator("tbody tr")).toHaveCount(2);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		const card = page.locator(".card_item", { hasText: "Création 2026" });
		await expect(card).toBeVisible();
		await card.getByText("2 rôles").click();
		await expect(card.locator("li")).toHaveText([`Hamlet : ${artists.alice.name}`, "Ophélie"]);
	});

	test("edit a model", async ({ page }) => {
		await openSpectacle(page, spectacles.miserablesParis);
		const card = page.locator(".card_item", { hasText: "Distribution 2026" });
		await card.getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le modèle" });
		await expect(dialog.getByRole("textbox", { name: "Nom*" })).toHaveValue("Distribution 2026");
		await expect(dialog.locator("tbody tr")).toHaveCount(2);

		await dialog.getByRole("textbox", { name: "Nom*" }).fill("Distribution 2027");
		const javert = dialog.locator("tbody tr").nth(1);
		await javert.locator(".artist-search-select input").fill("bob");
		await dialog.locator(".artist-search-select-item", { hasText: artists.bob.name }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		const updated = page.locator(".card_item", { hasText: "Distribution 2027" });
		await updated.getByText("2 rôles").click();
		await expect(updated.locator("li")).toHaveText([
			`Fantine : ${artists.alice.name}`,
			`Javert : ${artists.bob.name}`,
		]);
	});

	test("delete a model", async ({ page }) => {
		await openSpectacle(page, spectacles.miserablesParis);
		const card = page.locator(".card_item", { hasText: "Distribution 2026" });
		await card.getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer modèle" });
		await expect(dialog).toContainText("Spectacle : Les Misérables (Paris)");
		await expect(dialog).toContainText("Rôles définis : 2");

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(card).toBeVisible();

		await card.getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Modèles" })).not.toBeVisible();
	});

	test("edit the description, links and tracklist", async ({ page }) => {
		await openSpectacle(page, spectacles.miserablesParis);
		await expect(page.getByRole("heading", { name: "Programme" })).not.toBeVisible();

		await page.locator(".presentation .title").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le spectacle" });
		await dialog
			.getByRole("textbox", { name: "Description", exact: true })
			.fill("Comédie musicale d'après Victor Hugo");
		await dialog.getByRole("textbox", { name: "Source de la description" }).fill("pas une url");
		await dialog.getByRole("button", { name: "Ajouter un lien" }).click();
		await dialog.getByPlaceholder("Libellé").fill("Wikipédia");
		await dialog
			.getByPlaceholder("https://")
			.fill("https://fr.wikipedia.org/wiki/Les_Misérables_(comédie_musicale)");
		await dialog
			.locator("textarea.tracklist-input")
			.fill("# Acte 1\n- Prologue\n- Valjean *(chanson)*\n# Acte 2\n- Final");

		// the source must be a URL (checked by the browser: the form is not sent)
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).toBeVisible();
		expect(
			await dialog
				.getByRole("textbox", { name: "Source de la description" })
				.evaluate((el: HTMLInputElement) => el.validity.valid),
		).toBe(false);
		await dialog.getByRole("textbox", { name: "Source de la description" }).fill("https://fr.wikipedia.org");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await expect(page.locator(".description")).toContainText("Comédie musicale d'après Victor Hugo");
		await expect(page.locator(".description").getByRole("link", { name: "(source)" })).toHaveAttribute(
			"href",
			"https://fr.wikipedia.org",
		);
		await expect(page.locator(".presentation .general").getByRole("link", { name: "Wikipédia" })).toBeVisible();
		const tracklist = page.locator(".tracklist");
		await expect(tracklist.locator("h4")).toHaveText(["Acte 1", "Acte 2"]);
		await expect(tracklist.locator("li")).toHaveText(["Prologue", "Valjean (chanson)", "Final"]);
		await expect(tracklist.locator("em")).toHaveText("(chanson)");

		// emptied fields are removed from the page
		await page.reload();
		await page.locator(".presentation .title").getByRole("button", { name: "Modifier" }).click();
		await dialog.getByRole("textbox", { name: "Description", exact: true }).fill("");
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await dialog.locator("textarea.tracklist-input").fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.locator(".description")).toHaveCount(0);
		await expect(page.locator(".presentation .general a")).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Programme" })).not.toBeVisible();
	});
});
