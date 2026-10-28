import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { cuisine, peripheriques } = SEED.lifespan.categories;
const { souris, clavier, laptop, cafetiere } = SEED.lifespan.objects;

function rowLabels(page: Page) {
	return page.locator(".timeline-row-label");
}

function timelineRow(page: Page, name: string) {
	return page.locator(".timeline-row").filter({ has: page.getByText(name, { exact: true }) });
}

async function applyFilters(page: Page, filters: { start?: string; end?: string; categoryId?: string }) {
	if (filters.start) await page.getByLabel("Début de la période").fill(filters.start);
	if (filters.end) await page.getByLabel("Fin de la période").fill(filters.end);
	if (filters.categoryId) await page.getByLabel("Catégorie").selectOption(filters.categoryId);
	await page.getByRole("button", { name: "Appliquer" }).click();
}

test.describe("Lifespan - Timeline", () => {
	test.afterEach(resetDb);

	test("lifespan root goes to the timeline", async ({ page }) => {
		await page.goto("/lifespan");
		await expect(page).toHaveURL("/lifespan/timeline");
	});

	test("objects are grouped by category, sub-categories included", async ({ page }) => {
		await page.goto("/lifespan/timeline");
		// Categories by name
		await expect(page.locator(".timeline-category h3, .timeline-category h4")).toHaveText([
			"Cuisine",
			"Informatique",
			"Périphériques",
		]);
		// Inside a category: by type, then by first usage
		await expect(rowLabels(page)).toHaveText([cafetiere.name, laptop.name, clavier.name, souris.name]);
		// An unused category isn't shown
		await expect(page.getByRole("link", { name: "Vide" })).toHaveCount(0);
	});

	test("rows show the usage segments and the disposal", async ({ page }) => {
		await page.goto("/lifespan/timeline");
		const laptopSegments = timelineRow(page, laptop.name).locator(".timeline-segment");
		await expect(laptopSegments).toHaveCount(2);
		await expect(laptopSegments.nth(0)).toHaveAttribute("title", "En cours d'utilisation\n02/09/2024 - 01/05/2026");
		await expect(laptopSegments.nth(1)).toHaveClass(/paused ongoing/);
		await expect(laptopSegments.nth(1)).toHaveAttribute("title", "En pause\n01/05/2026 - en cours");

		const clavierSegments = timelineRow(page, clavier.name).locator(".timeline-segment");
		await expect(clavierSegments).toHaveCount(2);
		await expect(clavierSegments.nth(1)).toHaveAttribute("title", "Terminé, conservé\n10/01/2025 - 01/03/2025");
		await expect(timelineRow(page, clavier.name).locator(".timeline-dispose-marker")).toHaveAttribute(
			"title",
			"Sortie - Donné\n01/03/2025",
		);

		await expect(timelineRow(page, souris.name).locator(".timeline-segment")).toHaveClass(/in_use ongoing/);
		await expect(timelineRow(page, cafetiere.name)).toContainText("pas encore utilisé");
		await expect(timelineRow(page, cafetiere.name).locator(".timeline-segment")).toHaveCount(0);
	});

	test("filter on a category", async ({ page }) => {
		await page.goto("/lifespan/timeline");
		await applyFilters(page, { categoryId: peripheriques.id });
		await expect(page).toHaveURL(`/lifespan/timeline?categoryId=${peripheriques.id}`);
		await expect(page.locator(".timeline-category h3")).toHaveText(["Périphériques"]);
		await expect(rowLabels(page)).toHaveText([clavier.name, souris.name]);
	});

	test("a category title filters on it", async ({ page }) => {
		await page.goto("/lifespan/timeline");
		await page.getByRole("link", { name: "Cuisine" }).click();
		await expect(page).toHaveURL(`/lifespan/timeline?categoryId=${cuisine.id}`);
		await expect(rowLabels(page)).toHaveText([cafetiere.name]);
	});

	test("filter on a period", async ({ page }) => {
		await page.goto("/lifespan/timeline");
		await applyFilters(page, { start: "2026-01-01", end: "2026-12-31" });
		await expect(page).toHaveURL("/lifespan/timeline?from=2026-01-01&to=2026-12-31");
		// Disposed in 2025
		await expect(rowLabels(page)).toHaveText([cafetiere.name, laptop.name, souris.name]);
		await expect(page.locator(".timeline-year-band")).toHaveText(["2026"]);

		// Kept on reload
		await page.reload();
		await expect(page.getByLabel("Début de la période")).toHaveValue("2026-01-01");
		await expect(rowLabels(page)).toHaveCount(3);

		await page.getByRole("button", { name: "Réinitialiser" }).click();
		await expect(page).toHaveURL("/lifespan/timeline");
		await expect(rowLabels(page)).toHaveCount(4);
	});

	test("a filter without match", async ({ page }) => {
		await page.goto("/lifespan/timeline");
		await applyFilters(page, { start: "2010-01-01", end: "2010-12-31" });
		await expect(page.getByText("Aucun objet ne correspond aux filtres.")).toBeVisible();
		await expect(rowLabels(page)).toHaveCount(0);
	});

	test("add an object from the timeline keeps the filters", async ({ page }) => {
		await page.goto(`/lifespan/timeline?categoryId=${cuisine.id}`);
		await page.getByRole("button", { name: "Ajouter un objet" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un objet" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Grille-pain");
		await dialog.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Cuisine" });
		await dialog.getByRole("button", { name: "Ajouter un évènement" }).click();
		await dialog.locator('select[name="events.0.type"]').selectOption({ label: "Début d'utilisation" });
		await dialog.locator('input[name="events.0.date"]').fill("2026-10-20");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page).toHaveURL(`/lifespan/timeline?categoryId=${cuisine.id}`);
		// Used objects first
		await expect(rowLabels(page)).toHaveText(["Grille-pain", cafetiere.name]);
	});
});
