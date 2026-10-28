import type { Locator, Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { alice, littleWomen } = SEED.book;

function readingCard(page: Page, n: number) {
	return page.locator(".card_item").filter({ has: page.getByRole("heading", { name: `Lecture #${n}` }) });
}

function chapter(card: Locator, title: string) {
	return card.locator("li").filter({ hasText: title, hasNot: card.page().locator("li") });
}

// Opens Alice and starts a new (in-progress) reading: "Lecture #2"
async function startReading(page: Page) {
	await page.goto(`/reading-book/book/${alice.id}`);
	await page.getByRole("button", { name: "+ Commencer une lecture" }).click();
	const card = readingCard(page, 2);
	await expect(card).toBeVisible();
	return card;
}

test.describe("Reading Book - Readings", () => {
	test.afterEach(resetDb);

	test("complete reading is read-only", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		const card = readingCard(page, 1);
		await expect(card).toContainText("05/02/26 - 08/03/26 (5 jours)");
		await expect(card).toContainText("Statut : complete");
		await expect(chapter(card, "I: Down the Rabbit-Hole")).toHaveText("I: Down the Rabbit-Hole : 05/02/2026 🚇");

		await expect(card.getByRole("combobox")).toHaveCount(0);
		await expect(card.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
		await expect(card.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
		await expect(card.getByRole("button", { name: "Ajouter un contexte" })).toHaveCount(0);
	});

	test("abandoned reading hides the parts not started", async ({ page }) => {
		await page.goto(`/reading-book/book/${littleWomen.id}`);
		const card = readingCard(page, 1);
		await expect(card).toContainText("Statut : abandoned");
		await expect(card.locator("summary b")).toHaveText(["Part I"]);
		await expect(card).not.toContainText("Part II");
		// Only the chapters with dates are displayed
		await expect(card.locator("li li li")).toHaveCount(5);
	});

	test("start a new reading", async ({ page }) => {
		const card = await startReading(page);
		await expect(card.getByRole("combobox")).toHaveValue("in-progress");
		await expect(card.getByRole("button", { name: "Enregistrer" })).toBeVisible();
		await expect(card.getByRole("button", { name: "Supprimer" })).toBeVisible();
		await expect(card.getByRole("button", { name: "Ajouter un contexte" })).toHaveCount(12);
	});

	test("add a context to a chapter", async ({ page }) => {
		const card = await startReading(page);
		const firstChapter = chapter(card, "I: Down the Rabbit-Hole");
		await firstChapter.getByRole("button", { name: "Ajouter un contexte" }).click();
		await firstChapter.locator('input[type="date"]').fill("2026-10-01");
		await firstChapter.getByPlaceholder("Tag").fill("metro");
		await card.getByRole("button", { name: "Enregistrer" }).click();

		await expect(firstChapter).toHaveText("I: Down the Rabbit-Hole : 01/10/2026 🚇");
		await expect(card).toContainText("01/10/26 (1 jour)");
		await expect(card.getByRole("button", { name: "Ajouter un contexte" })).toHaveCount(11);
	});

	test("edit a context before saving", async ({ page }) => {
		const card = await startReading(page);
		const firstChapter = chapter(card, "I: Down the Rabbit-Hole");
		await firstChapter.getByRole("button", { name: "Ajouter un contexte" }).click();
		await firstChapter.getByRole("button", { name: "Ajouter un tag" }).click();
		await expect(firstChapter.getByPlaceholder("Tag")).toHaveCount(2);

		await firstChapter.getByRole("button", { name: "Supprimer le contexte" }).click();
		await expect(firstChapter.locator('input[type="date"]')).toHaveCount(0);

		await card.getByRole("button", { name: "Enregistrer" }).click();
		await page.reload();
		await expect(chapter(readingCard(page, 2), "I: Down the Rabbit-Hole")).toHaveText("I: Down the Rabbit-Hole");
	});

	test("quick input fills several chapters", async ({ page }) => {
		const card = await startReading(page);
		await card.getByRole("button", { name: "Activer la saisie rapide" }).click();
		const helper = card.locator(".sticky-helper");
		await helper.locator('input[type="date"]').fill("2026-10-02");
		await helper.getByPlaceholder("Context tag").fill("dodo");

		await chapter(card, "I: Down the Rabbit-Hole")
			.getByRole("button", { name: "Appliquer le contexte rapide" })
			.click();
		await chapter(card, "II: The Pool of Tears")
			.getByRole("button", { name: "Appliquer le contexte rapide" })
			.click();
		await expect(chapter(card, "II: The Pool of Tears").locator('input[type="date"]')).toHaveValue("2026-10-02");

		await helper.getByRole("button", { name: "Enregistrer" }).click();
		await expect(chapter(card, "I: Down the Rabbit-Hole")).toHaveText("I: Down the Rabbit-Hole : 02/10/2026 🛌");
		await expect(chapter(card, "II: The Pool of Tears")).toHaveText("II: The Pool of Tears : 02/10/2026 🛌");
	});

	for (const [label, status] of [
		["Fini", "complete"],
		["Abandonné", "abandoned"],
	]) {
		test(`set the reading status to ${status}`, async ({ page }) => {
			const card = await startReading(page);
			await card.getByRole("combobox").selectOption({ label });
			await card.getByRole("button", { name: "Enregistrer" }).click();

			await expect(card).toContainText(`Statut : ${status}`);
			await expect(card.getByRole("combobox")).toHaveCount(0);
			await expect(card.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
			await expect(card.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
		});
	}

	test("delete a reading", async ({ page }) => {
		const card = await startReading(page);
		await card.getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer lecture" });
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText("Cette lecture contient 0 entrée(s).");

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(card).toBeVisible();

		await card.getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(card).not.toBeVisible();
		await expect(readingCard(page, 1)).toBeVisible();
	});
});
