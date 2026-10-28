import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { works, spectacles, places } = SEED.show;

function groupTitles(page: Page) {
	return page.locator("table.works tbody.year td");
}

function workBodies(page: Page) {
	return page.locator("table.works tbody.work");
}

function workBody(page: Page, name: string) {
	return workBodies(page).filter({ has: page.getByRole("cell", { name, exact: true }) });
}

test.describe("Shows - Works", () => {
	test.afterEach(resetDb);

	test("list shows the works with their spectacles and places", async ({ page }) => {
		await page.goto("/shows/works");
		await expect(groupTitles(page)).toHaveText([
			"Années 2025 - 2027 (2 oeuvres - 3 spectacles - 6 représentations)",
		]);
		await expect(workBodies(page)).toHaveCount(2);

		// One row per spectacle and place name, spectacle names shown when a work has several
		const miserables = workBody(page, works.miserables.name);
		await expect(miserables.locator("tr")).toHaveCount(3);
		await expect(miserables.locator("tr").first().locator("td")).toHaveText([
			"#1",
			works.miserables.name,
			"4",
			"2",
			spectacles.miserablesParis.name,
			places.chatelet.formerName,
			"1",
			"20/03/25 ",
			"",
		]);
		await expect(miserables.locator("tr").nth(2)).toContainText(spectacles.miserablesLondres.name);
		await expect(miserables.locator("tr").nth(2)).toContainText("📅15/01/27");

		const hamlet = workBody(page, works.hamlet.name);
		await expect(hamlet.locator("tr")).toHaveCount(1);
		// Single spectacle: its name isn't repeated
		await expect(hamlet.locator("td").nth(4)).toHaveText("");
	});

	test("group the list by year", async ({ page }) => {
		await page.goto("/shows/works");
		await page.getByRole("checkbox", { name: "Grouper par année" }).check();
		await expect(groupTitles(page)).toHaveText([
			"Année 2027 (1 oeuvres - 1 spectacles - 1 représentations)",
			"Année 2026 (2 oeuvres - 2 spectacles - 3 représentations)",
			"Année 2025 (1 oeuvres - 2 spectacles - 2 représentations)",
		]);
	});

	test("edit a work", async ({ page }) => {
		await page.goto("/shows/works");
		await workBody(page, works.hamlet.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'oeuvre" });
		await expect(dialog.getByRole("textbox", { name: "Nom *" })).toHaveValue(works.hamlet.name);
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("La Tragique Histoire d'Hamlet");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(workBody(page, "La Tragique Histoire d'Hamlet")).toBeVisible();
	});

	test("add a work", async ({ page }) => {
		await page.goto("/shows/works");
		await page.getByRole("button", { name: "Ajouter une oeuvre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une oeuvre" });
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Cyrano de Bergerac");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		// A work without spectacle is only listed in the spectacle form
		await page.goto("/shows/history/2026");
		await page.locator(".fab-main").click();
		const performanceDialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
		await performanceDialog
			.locator(".panel", { hasText: "Spectacle & Oeuvre" })
			.getByRole("button", { name: "Ajouter" })
			.click();
		await expect(performanceDialog.locator('select[name="spectacle.workId"] option')).toContainText([
			"Cyrano de Bergerac",
		]);
	});

	test("add a performance of a new spectacle of a new work", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await page.locator(".fab-main").click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
		await dialog
			.locator(".panel", { hasText: "Spectacle & Oeuvre" })
			.getByRole("button", { name: "Ajouter" })
			.click();
		await expect(dialog.getByRole("heading", { name: "Nouveau spectacle" })).toBeVisible();
		await dialog.locator('input[name="spectacle.name"]').fill("Cyrano (Porte Saint-Martin)");
		await dialog.getByRole("button", { name: "Ajouter Oeuvre" }).click();
		await expect(dialog.getByRole("heading", { name: "Nouvelle oeuvre" })).toBeVisible();
		await dialog.locator('input[name="work.name"]').fill("Cyrano de Bergerac");

		await dialog.locator('select[name="performance.placeId"]').selectOption({ label: places.comedie.name });
		await dialog.getByLabel("Date").fill("2026-12-05T20:00");
		await dialog.getByRole("textbox", { name: "Place" }).fill("K9");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.locator("table.performances")).toContainText("Cyrano (Porte Saint-Martin)");

		await page.goto("/shows/works");
		const cyrano = workBody(page, "Cyrano de Bergerac");
		await expect(cyrano).toContainText(places.comedie.name);
		await expect(cyrano).toContainText("📅05/12/26");
	});

	test("a new spectacle needs a work", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await page.locator(".fab-main").click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
		await dialog
			.locator(".panel", { hasText: "Spectacle & Oeuvre" })
			.getByRole("button", { name: "Ajouter" })
			.click();
		await dialog.locator('input[name="spectacle.name"]').fill("Sans oeuvre");
		await dialog.locator('select[name="performance.placeId"]').selectOption({ label: places.comedie.name });
		await dialog.getByLabel("Date").fill("2026-12-05T20:00");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Choisir une oeuvre ou en ajouter une nouvelle")).toBeVisible();

		await dialog.locator('select[name="spectacle.workId"]').selectOption({ label: works.hamlet.name });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.locator("table.performances")).toContainText("Sans oeuvre");
	});

	test("the work name is required", async ({ page }) => {
		await page.goto("/shows/works");
		await page.getByRole("button", { name: "Ajouter une oeuvre" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une oeuvre" });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
	});
});
