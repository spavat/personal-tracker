import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { mockPodcast, mockTube, oldShow } = SEED.internet;
const currentMonth = new Date().toISOString().slice(0, 7);

function programCards(page: Page) {
	return page.locator(".internet .grid .card_item");
}

function programCard(page: Page, name: string) {
	return programCards(page).filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Internet - History", () => {
	test.afterEach(resetDb);

	test("module root redirects to the current month history", async ({ page }) => {
		await page.goto("/internet");
		await expect(page).toHaveURL(`/internet/history/${currentMonth}`);
	});

	test("a month shows its programs, latest first", async ({ page }) => {
		await page.goto("/internet/history/2026-10");
		await expect(page.getByRole("heading", { name: "octobre 2026" })).toBeVisible();
		await expect(programCards(page)).toHaveCount(2);
		await expect(programCards(page).locator(".title")).toHaveText([mockPodcast.name, mockTube.name]);

		const card = programCard(page, mockPodcast.name);
		await expect(card).toContainText("Pod Caster - Mock Radio");
		await expect(card).toContainText("📅 24/10/2026 🎧Podcast épisode 1");
		// Real duration (30) is used instead of the duration (45) when set
		await expect(card.locator("summary")).toHaveText("2 épisodes (1h 10min)");

		await card.locator("summary").click();
		await expect(card.locator("details > div")).toHaveText([
			"10/10/2026: Podcast épisode 0 40min (podcast)",
			"24/10/2026: Podcast épisode 1 30min* (podcast)",
		]);
	});

	test("an empty month shows a message", async ({ page }) => {
		await page.goto("/internet/history/2026-08");
		await expect(page.getByText("Aucun programme écouté/vu ce mois-ci.")).toBeVisible();
		await expect(programCards(page)).toHaveCount(0);
	});

	test("navigate between months", async ({ page }) => {
		await page.goto("/internet/history/2026-10");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page.getByRole("heading", { name: "septembre 2026" })).toBeVisible();
		await expect(programCards(page).locator(".title")).toHaveText([mockTube.name]);

		await page.goto("/internet/history/2025-03");
		await expect(programCards(page).locator(".title")).toHaveText([oldShow.name]);

		await page.goto("/internet/history/2025-01");
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();
	});

	test("next month is disabled on the current month", async ({ page }) => {
		await page.goto(`/internet/history/${currentMonth}`);
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
	});

	test("click a program opens its details", async ({ page }) => {
		await page.goto("/internet/history/2026-10");
		await page.getByRole("link", { name: mockTube.name }).click();
		await expect(page).toHaveURL(`/internet/${mockTube.id}`);
		await expect(page.getByRole("heading", { name: mockTube.name })).toBeVisible();
	});

	test("add an episode from the history", async ({ page }) => {
		await page.goto("/internet/history/2026-10");
		await page.getByRole("button", { name: "Ajouter un programme" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter épisode" });
		await expect(dialog).toBeVisible();

		await dialog.locator('select[name="programId"]').selectOption({ label: oldShow.name });
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Retour du vieux show");
		await dialog.getByRole("spinbutton", { name: "Durée *" }).fill("50");
		await dialog.getByLabel("Date *").fill("2026-10-05");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(programCard(page, oldShow.name)).toContainText("Retour du vieux show");
	});

	test("submenu switches between pages", async ({ page }) => {
		await page.goto("/internet/history/2026-10");
		await page.getByRole("link", { name: "Liste" }).click();
		await expect(page).toHaveURL("/internet/list");
		await page.getByRole("link", { name: "Statistiques" }).click();
		await expect(page).toHaveURL(/\/internet\/stats\/\d{4}$/);
		await page.getByRole("link", { name: "Sync Podcast" }).click();
		await expect(page).toHaveURL("/internet/sync");
		await page.getByRole("link", { name: "Historique" }).click();
		await expect(page).toHaveURL(`/internet/history/${currentMonth}`);
	});
});
