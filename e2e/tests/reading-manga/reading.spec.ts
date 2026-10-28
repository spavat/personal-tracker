import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { onePiece } = SEED.manga;

function readingRows(page: Page) {
	return page.locator("table.readings tbody tr");
}

// Fourth column holds the reading name
function readingNames(page: Page) {
	return readingRows(page).locator("td:nth-child(4)");
}

function readingRow(page: Page, name: string) {
	return readingRows(page).filter({ has: page.getByRole("cell", { name, exact: true }) });
}

// Same rule as getCurrentOrPreviousDate (front/src/utils.tsx): before 4 AM, the reading belongs to the previous day
function currentOrPreviousDate() {
	const now = new Date();
	if (now.getHours() < 4) {
		now.setDate(now.getDate() - 1);
	}
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function openOnePiece(page: Page) {
	await page.goto(`/reading-manga/manga/${onePiece.id}`);
	await expect(readingRows(page)).toHaveCount(6);
}

async function openAddModal(page: Page) {
	await openOnePiece(page);
	await page.getByRole("button", { name: "Ajouter une lecture" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter lecture" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Reading Manga - Readings", () => {
	test.afterEach(resetDb);

	test("group the readings", async ({ page }) => {
		await openOnePiece(page);
		await page.getByRole("checkbox", { name: "Grouper les lectures" }).check();
		await expect(readingNames(page)).toHaveText(["T06", "T04-05 (2)", "T01-03 (3)"]);

		// Merged readings can't be edited or deleted
		const merged = readingRow(page, "T04-05 (2)");
		await expect(merged.getByRole("button", { name: "Modifier la lecture" })).toBeDisabled();
		await expect(merged.getByRole("button", { name: "Supprimer la lecture" })).toBeDisabled();
		await expect(readingRow(page, "T06").getByRole("button", { name: "Modifier la lecture" })).toBeEnabled();

		await page.getByRole("checkbox", { name: "Grouper les lectures" }).uncheck();
		await expect(readingRows(page)).toHaveCount(6);
	});

	test("add a reading", async ({ page }) => {
		const dialog = await openAddModal(page);
		await expect(dialog.getByLabel("Date")).toHaveValue(currentOrPreviousDate());

		await dialog.getByRole("textbox", { name: "Nom" }).fill("07");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption("volume");
		await dialog.getByRole("textbox", { name: "Titre" }).fill("Les trois capitaines");
		await dialog.getByRole("textbox", { name: "Edition" }).fill("Collector");
		await dialog.getByLabel("Date").fill("2026-10-20");
		await dialog.getByRole("textbox", { name: "Langue" }).fill("fr");
		await dialog.getByRole("combobox", { name: "Origine" }).selectOption("Livre");
		await dialog.getByText("Ajouter un tag").click();
		await dialog.locator('input[name="reading.contextTags.0.value"]').fill("train");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(readingRows(page)).toHaveCount(7);
		await expect(readingRows(page).first().locator("td")).toHaveText([
			"#1",
			"mar.",
			"20/10/26",
			"T07 - Les trois capitaines train",
			"Collector",
			"fr",
			"Livre",
			"",
		]);
	});

	test("the language is required", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("07");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("La langue est obligatoire")).toBeVisible();
		await expect(dialog).toBeVisible();
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(readingRows(page)).toHaveCount(6);
	});

	test("the name is required and tags can't be empty", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Langue" }).fill("fr");
		await dialog.getByText("Ajouter un tag").click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await expect(dialog.getByText("Un tag ne peut pas être vide")).toBeVisible();
		await expect(dialog).toBeVisible();
	});

	test("add a reading with ctrl+shift+n", async ({ page }) => {
		await openOnePiece(page);
		await page.keyboard.press("Control+Shift+N");
		await expect(page.getByRole("dialog", { name: "Ajouter lecture" })).toBeVisible();
	});

	test("edit a reading", async ({ page }) => {
		await openOnePiece(page);
		await readingRow(page, "T06").getByRole("button", { name: "Modifier la lecture" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier lecture" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue("06");
		await expect(dialog.getByLabel("Date")).toHaveValue("2026-05-12");
		await expect(dialog.getByRole("combobox", { name: "Origine" })).toHaveValue("Digital");

		await dialog.getByRole("textbox", { name: "Nom" }).fill("06b");
		await dialog.getByRole("combobox", { name: "Origine" }).selectOption("Livre");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(readingRows(page)).toHaveCount(6);
		await expect(readingRow(page, "T06b").locator("td").nth(6)).toHaveText("Livre");
	});

	test("delete a reading", async ({ page }) => {
		await openOnePiece(page);
		await readingRow(page, "T06").getByRole("button", { name: "Supprimer la lecture" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer lecture" });
		await expect(dialog).toContainText("Nom : T06");
		await expect(dialog).toContainText("Date : 12/05/26");

		// Cancel keeps the reading
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(readingRows(page)).toHaveCount(6);

		await readingRow(page, "T06").getByRole("button", { name: "Supprimer la lecture" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(readingNames(page)).toHaveText(["T05", "T04", "T03", "T02", "T01"]);
	});

	test("quick add the next reading", async ({ page }) => {
		await openOnePiece(page);
		await readingRow(page, "T06").getByRole("button", { name: "Ajouter le suivant" }).dblclick();

		await expect(readingRows(page)).toHaveCount(7);
		const [year, month, day] = currentOrPreviousDate().split("-");
		await expect(readingRows(page).first().locator("td")).toHaveText([
			"#1",
			/.+/,
			`${day}/${month}/${year.slice(2)}`,
			"T07",
			"",
			"fr",
			"Digital",
			"",
		]);
	});

	test("quick add from a group uses its last reading", async ({ page }) => {
		await openOnePiece(page);
		await page.getByRole("checkbox", { name: "Grouper les lectures" }).check();
		await readingRow(page, "T01-03 (3)").getByRole("button", { name: "Ajouter le suivant" }).dblclick();

		// Grouped desc: the next one after "01-03" is "04", added today
		await expect(readingNames(page).first()).toHaveText("T04");
		await page.getByRole("checkbox", { name: "Grouper les lectures" }).uncheck();
		await expect(readingRows(page)).toHaveCount(7);
	});
});
