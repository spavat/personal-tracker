import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { onePiece, tomie, frieren } = SEED.manga;
const currentYear = new Date().getFullYear();

function mangaCards(page: Page) {
	return page.locator(".reading-manga .grid .card_item");
}

function mangaCard(page: Page, title: string) {
	return mangaCards(page).filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

test.describe("Reading Manga - History", () => {
	test.afterEach(resetDb);

	test("module root redirects to the current year history", async ({ page }) => {
		await page.goto("/reading-manga");
		await expect(page).toHaveURL(`/reading-manga/history/${currentYear}`);
		await expect(page.getByRole("heading", { name: `Année ${currentYear}` })).toBeVisible();
	});

	test("2026 shows the mangas grouped by month", async ({ page }) => {
		await page.goto("/reading-manga/history/2026");
		await expect(page.locator(".reading-manga h2")).toHaveText(["octobre 2026 (1)", "mai 2026 (1)"]);
		await expect(mangaCards(page)).toHaveCount(2);
		await expect(mangaCards(page).first()).toContainText(frieren.title);
	});

	test("card shows the readings of the year", async ({ page }) => {
		await page.goto("/reading-manga/history/2026");
		const card = mangaCard(page, onePiece.title);
		await expect(card).toContainText("Eiichirô ODA");
		await expect(card).toContainText("📅 12/05/2026 ⚙️T06");
		await expect(card.locator("summary")).toHaveText("Lecture : 6 volumes");

		await card.locator("summary").click();
		const lines = card.locator(".monospace");
		await expect(lines).toHaveCount(3);
		await expect(lines.nth(0)).toContainText("10/05/2026: T01-03 (3)");
		await expect(lines.nth(1)).toContainText("11/05/2026: T04-05 (2)");
		await expect(lines.nth(2)).toContainText("12/05/2026: T06");
		await expect(lines.nth(2)).toContainText("FR Digital");
	});

	test("navigate between years", async ({ page }) => {
		await page.goto("/reading-manga/history/2026");
		await expect(mangaCards(page)).toHaveCount(2);

		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page.getByRole("heading", { name: "Année 2025" })).toBeVisible();
		await expect(mangaCards(page)).toHaveCount(1);
		await expect(mangaCard(page, tomie.title).locator(".fa-circle-check")).toBeVisible();

		await page.getByRole("button", { name: "Go to previous" }).click();
		await page.getByRole("button", { name: "Go to previous" }).click();
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page.getByRole("heading", { name: "Année 2022" })).toBeVisible();
		await expect(mangaCards(page)).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();
	});

	test("next year is disabled on the current year", async ({ page }) => {
		await page.goto(`/reading-manga/history/${currentYear}`);
		await expect(page.getByRole("heading", { name: `Année ${currentYear}` })).toBeVisible();
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
	});

	test("click a manga opens its details", async ({ page }) => {
		await page.goto("/reading-manga/history/2026");
		await page.getByRole("link", { name: frieren.title }).click();
		await expect(page).toHaveURL(`/reading-manga/manga/${frieren.id}`);
		await expect(page.getByRole("heading", { name: frieren.title })).toBeVisible();
	});

	test("add a manga from the history", async ({ page }) => {
		await page.goto("/reading-manga/history/2026");
		await page.getByRole("button", { name: "Ajouter un manga" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un manga" });
		await expect(dialog).toBeVisible();
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("History Manga");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(page.getByRole("heading", { name: "History Manga" })).toBeVisible();
	});

	test("submenu switches between history and list", async ({ page }) => {
		await page.goto("/reading-manga/history/2026");
		await page.getByRole("link", { name: "Liste" }).click();
		await expect(page).toHaveURL("/reading-manga/list");
		await expect(page.locator("table.mangas")).toBeVisible();

		await page.getByRole("link", { name: "Historique" }).click();
		await expect(page).toHaveURL(`/reading-manga/history/${currentYear}`);
	});
});
