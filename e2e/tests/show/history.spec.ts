import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { spectacles, places } = SEED.show;

const currentYear = new Date().getFullYear();

function performanceRows(page: Page) {
	// Month title rows have a single cell
	return page.locator("table.performances tbody tr").filter({ has: page.locator("td:nth-child(2)") });
}

function monthTitles(page: Page) {
	return page.locator("table.performances tbody tr td[colspan] .title");
}

test.describe("Shows - History", () => {
	test.afterEach(resetDb);

	test("history root redirects to the current year", async ({ page }) => {
		await page.goto("/shows/history");
		await expect(page).toHaveURL(`/shows/history/${currentYear}`);
		await expect(page.getByRole("heading", { name: `Spectacles de l'année ${currentYear}` })).toBeVisible();
	});

	test("performances are grouped by month", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await expect(monthTitles(page)).toHaveText(["février 2026", "avril 2026", "septembre 2026"]);
		await expect(page.locator("table.performances tbody tr td[colspan]").first()).toContainText("(2)");
		await expect(performanceRows(page)).toHaveCount(4);
		// The canceled performance has no number
		await expect(performanceRows(page).locator("td:first-child")).toHaveText(["#1", "", "#2", "#3"]);
	});

	test("navigate between years", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page).toHaveURL("/shows/history/2025");
		await expect(monthTitles(page)).toHaveText(["mars 2025", "novembre 2025"]);
		await expect(performanceRows(page).nth(0)).toContainText(places.chatelet.formerName);

		await page.getByRole("button", { name: "Go to next" }).click();
		await page.getByRole("button", { name: "Go to next" }).click();
		await expect(page).toHaveURL("/shows/history/2027");
		await expect(performanceRows(page)).toHaveCount(1);
		await expect(performanceRows(page).first()).toContainText(spectacles.miserablesLondres.name);
	});

	test("navigation stops at 2021 and two years ahead", async ({ page }) => {
		await page.goto("/shows/history/2021");
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();
		await expect(performanceRows(page)).toHaveCount(0);

		await page.goto(`/shows/history/${currentYear + 2}`);
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
	});

	test("add a performance with an existing spectacle and place", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await page.locator(".fab-main").click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
		await expect(dialog).toBeVisible();

		await dialog.getByRole("combobox", { name: "Spectacle" }).selectOption({ label: spectacles.hamlet.name });
		await dialog.locator('select[name="performance.placeId"]').selectOption({ label: places.sondheim.name });
		await dialog.getByLabel("Date").fill("2026-06-12T19:00");
		await dialog.getByRole("textbox", { name: "Place" }).fill("H8");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(monthTitles(page)).toHaveText(["février 2026", "avril 2026", "juin 2026", "septembre 2026"]);
		const row = performanceRows(page).nth(3);
		await expect(row.locator("td")).toHaveText([
			"#3",
			"12/06/26 19:00",
			spectacles.hamlet.name,
			places.sondheim.name,
			"",
			"🎫 H8",
			"",
		]);
	});

	test("cancel the add modal", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await page.locator(".fab-main").click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(performanceRows(page)).toHaveCount(4);
	});

	test("the add modal shows the missing fields", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await page.locator(".fab-main").click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Le spectacle est obligatoire")).toBeVisible();
		await expect(dialog.getByText("Le lieu est obligatoire")).toBeVisible();
		await expect(dialog.getByText("La date est obligatoire")).toBeVisible();
		await expect(performanceRows(page)).toHaveCount(4);
	});

	test("a closed new spectacle panel isn't saved", async ({ page }) => {
		await page.goto("/shows/history/2026");
		await page.locator(".fab-main").click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une représentation" });
		await dialog
			.locator(".panel", { hasText: "Spectacle & Oeuvre" })
			.getByRole("button", { name: "Ajouter" })
			.click();
		await expect(dialog.getByRole("heading", { name: "Nouveau spectacle" })).toBeVisible();
		// Choosing an existing spectacle closes the empty panel
		await dialog.getByRole("combobox", { name: "Spectacle" }).selectOption({ label: spectacles.hamlet.name });
		await expect(dialog.getByRole("heading", { name: "Nouveau spectacle" })).not.toBeVisible();

		await dialog.locator('select[name="performance.placeId"]').selectOption({ label: places.comedie.name });
		await dialog.getByLabel("Date").fill("2026-06-12T19:00");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(performanceRows(page)).toHaveCount(5);
	});
});
