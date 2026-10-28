import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { track } = SEED.sport;

// Seeded segments: 0:00 running "Échauffement", 5:00 pause, 6:00 running "Segment #2" (track of 12 min, 2.4 km)

function paceRows(page: Page) {
	return page
		.getByRole("table")
		.filter({ has: page.getByRole("columnheader", { name: "Libellé" }) })
		.first();
}

function segmentsTable(page: Page) {
	return page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Temps" }) });
}

function segmentRow(page: Page, time: string) {
	return segmentsTable(page)
		.locator("tbody tr")
		.filter({ has: page.getByRole("cell", { name: time, exact: true }) });
}

async function addSegment(page: Page, time: string, type: string, label = "") {
	await page.getByPlaceholder("mm:ss").fill(time);
	await page.getByRole("combobox", { name: "Type" }).selectOption({ label: type });
	await page.getByPlaceholder("Libellé (optionnel)").fill(label);
	await page.getByRole("button", { name: "Ajouter", exact: true }).click();
}

test.describe("Sport - Segments", () => {
	test.afterEach(resetDb);

	test.beforeEach(async ({ page }) => {
		await page.goto(`/sport/${track.id}`);
		await expect(page.getByRole("heading", { name: "Segments" })).toBeVisible();
	});

	test("segments and their pace", async ({ page }) => {
		await expect(paceRows(page).locator("tbody tr")).toHaveText([
			"Échauffement1.00 km5:005:00/km",
			"Pause – 1:00",
			"Segment #21.20 km6:005:00/km",
		]);
		await expect(segmentsTable(page).locator("tbody tr td:nth-child(1)")).toHaveText(["0:00", "5:00", "6:00"]);
		await expect(segmentRow(page, "5:00").locator("td").nth(1)).toHaveText("1.00 km");
		await expect(segmentRow(page, "5:00").locator("td").nth(2)).toHaveText("Pause");
	});

	test("add a segment", async ({ page }) => {
		await addSegment(page, "8:00", "Pause / marche", "Ravito");
		await expect(segmentsTable(page).locator("tbody tr td:nth-child(1)")).toHaveText([
			"0:00",
			"5:00",
			"6:00",
			"8:00",
		]);
		await expect(paceRows(page).locator("tbody tr")).toHaveText([
			"Échauffement1.00 km5:005:00/km",
			"Pause – 1:00",
			"Segment #20.40 km2:005:00/km",
			"Pause (Ravito) – 4:00",
		]);
		// Saved
		await page.reload();
		await expect(segmentRow(page, "8:00").locator("td").nth(1)).toHaveText("1.60 km");
	});

	test("a segment time is given in seconds", async ({ page }) => {
		await addSegment(page, "90", "Course");
		await expect(segmentRow(page, "1:30").locator("td").nth(2)).toHaveText("Course");
	});

	test("the segment form checks the time", async ({ page }) => {
		await addSegment(page, "abc", "Course");
		await expect(page.getByText("Format attendu : mm:ss ou secondes")).toBeVisible();
		await addSegment(page, "5:00", "Course");
		await expect(page.getByText("Un segment existe déjà à ce timecode")).toBeVisible();
		await expect(segmentsTable(page).locator("tbody tr")).toHaveCount(3);
	});

	test("rename a segment", async ({ page }) => {
		const label = segmentRow(page, "0:00").getByRole("textbox");
		await label.fill("Warm-up");
		await label.press("Enter");
		await expect(paceRows(page).locator("tbody tr").first()).toContainText("Warm-up");

		await page.reload();
		await expect(segmentRow(page, "0:00").getByRole("textbox")).toHaveValue("Warm-up");
	});

	test("delete a segment", async ({ page }) => {
		await segmentRow(page, "5:00").getByRole("button", { name: "Supprimer" }).click();
		await expect(segmentsTable(page).locator("tbody tr td:nth-child(1)")).toHaveText(["0:00", "6:00"]);
		await expect(paceRows(page).locator("tbody tr")).toHaveText([
			"Échauffement1.20 km6:005:00/km",
			"Segment #21.20 km6:005:00/km",
		]);
	});

	test("without segments the whole run is summed up", async ({ page }) => {
		for (const time of ["0:00", "5:00", "6:00"]) {
			await segmentRow(page, time).getByRole("button", { name: "Supprimer" }).click();
			await expect(segmentRow(page, time)).toHaveCount(0);
		}
		await expect(segmentsTable(page).locator("tbody tr")).toHaveText("Aucun segment.");
		await expect(paceRows(page).locator("tbody tr")).toHaveText(["Course complète2.40 km12:005:00/km"]);
	});
});
