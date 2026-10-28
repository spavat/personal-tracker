import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { track, footing, swim, bike, hike } = SEED.sport;

function activityRows(page: Page) {
	return page.locator("table.activities tbody tr");
}

function activityRow(page: Page, name: string) {
	return activityRows(page).filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Sport - List", () => {
	test.afterEach(resetDb);

	test("list shows the activities, newest first", async ({ page }) => {
		await page.goto("/sport/list");
		await expect(activityRows(page).locator("td:nth-child(3)")).toHaveText([
			track.name,
			footing.name,
			swim.name,
			bike.name,
			hike.name,
		]);
		await expect(activityRow(page, footing.name).locator("td")).toHaveText([
			"2",
			"11/10/2026",
			footing.name,
			"Course à pied",
			"10.2 km",
			"55min",
			"5:23 /km",
			"\u00a0",
		]);
		await expect(activityRow(page, bike.name).locator("td").nth(3)).toHaveText("Cyclisme");
		await expect(activityRow(page, bike.name).locator("td").nth(5)).toHaveText("2h 15min");
		await expect(activityRow(page, hike.name).locator("td").nth(3)).toHaveText("Randonnée");
	});

	test("an activity name opens its details", async ({ page }) => {
		await page.goto("/sport/list");
		await page.getByRole("link", { name: swim.name }).click();
		await expect(page).toHaveURL(`/sport/${swim.id}`);
		await expect(page.getByRole("heading", { name: swim.name })).toBeVisible();
	});

	test("edit an activity from the list", async ({ page }) => {
		await page.goto("/sport/list");
		await activityRow(page, swim.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier activité" });
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue(swim.name);
		await expect(dialog.getByRole("combobox", { name: "Type" })).toHaveValue("swimming");
		await expect(dialog.getByRole("spinbutton", { name: "Distance (km)" })).toHaveValue("1.5");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Piscine olympique");
		await dialog.getByRole("spinbutton", { name: "Distance (km)" }).fill("2");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(activityRow(page, "Piscine olympique").locator("td").nth(4)).toHaveText("2 km");
	});

	test("edit an activity of a type out of the form's list", async ({ page }) => {
		await page.goto("/sport/list");
		await activityRow(page, hike.name).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier activité" });
		await expect(dialog.getByRole("combobox", { name: "Type" })).toHaveValue("hiking");
		await dialog.getByRole("textbox", { name: "Commentaire" }).fill("Brouillard");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(activityRow(page, hike.name).locator("td").nth(3)).toHaveText("Randonnée");
	});

	test("delete an activity from the list", async ({ page }) => {
		await page.goto("/sport/list");
		await activityRow(page, bike.name).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer activité" });
		await expect(dialog).toContainText(`Êtes-vous sûr de vouloir supprimer l'activité ${bike.name} du 30/09/26 ?`);

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(activityRows(page)).toHaveCount(5);

		await activityRow(page, bike.name).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(activityRows(page)).toHaveCount(4);
		await expect(activityRow(page, bike.name)).toHaveCount(0);
	});
});
