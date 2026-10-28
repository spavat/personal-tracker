import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { track, footing, swim } = SEED.sport;

async function openActivity(page: Page, activity: { id: string; name: string }) {
	await page.goto(`/sport/${activity.id}`);
	await expect(page.getByRole("heading", { name: activity.name })).toBeVisible();
}

function title(page: Page) {
	return page.locator(".presentation .title");
}

function general(page: Page) {
	return page.locator(".presentation .general");
}

test.describe("Sport - Activity details", () => {
	test.afterEach(resetDb);

	test("an activity without GPS track", async ({ page }) => {
		await openActivity(page, footing);
		await expect(general(page).locator("p").first()).toHaveText(
			[
				"Type : Course à pied",
				"Date : 11/10/2026",
				"Distance : 10.2 km",
				"Temps : 55min (en mouvement 50min)",
				"Allure : 5:23 /km",
				"Dénivelé positif : 85 m",
				"Dénivelé négatif : 80 m",
				"Dénivelé : 5 m",
			].join(""),
		);
		await expect(general(page)).toContainText("Bonnes sensations");
		// Nothing to download, crop or draw
		await expect(title(page).getByRole("button", { name: "Télécharger le fichier GPX" })).toHaveCount(0);
		await expect(title(page).getByRole("button", { name: "Rogner le tracé" })).toHaveCount(0);
		await expect(page.locator(".leaflet-container")).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Segments" })).toHaveCount(0);
	});

	test("an activity without elevation hides it", async ({ page }) => {
		await openActivity(page, swim);
		await expect(general(page)).toContainText("Type : Natation");
		await expect(general(page)).toContainText("Temps : 35min (en mouvement 30min)");
		await expect(general(page)).not.toContainText("Dénivelé");
	});

	test("an activity with a GPS track", async ({ page }) => {
		await openActivity(page, track);
		await expect(general(page)).toContainText("Distance : 2.4 km");
		await expect(title(page).getByRole("button", { name: "Rogner le tracé" })).toBeVisible();
		await expect(page.locator(".leaflet-container")).toBeVisible();

		const splits = page.locator("table.list").first().locator("tbody tr");
		await expect(splits).toHaveText(["15:00/km", "25:00/km", "3 (400 m)5:00/km"]);
		await expect(page.getByRole("heading", { name: "Segments" })).toBeVisible();
	});

	test("edit an activity", async ({ page }) => {
		await openActivity(page, footing);
		await title(page).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier activité" });
		await expect(dialog.getByLabel("Date")).toHaveValue("2026-10-11T09:30");
		await expect(dialog.getByRole("spinbutton", { name: "Temps total (min)" })).toHaveValue("55");
		await dialog.getByRole("spinbutton", { name: "Temps total (min)" }).fill("58");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(general(page)).toContainText("Temps : 58min (en mouvement 50min)");
		// The details out of the form are kept
		await expect(general(page)).toContainText("Dénivelé positif : 85 m");
		await page.reload();
		await expect(general(page)).toContainText("Dénivelé positif : 85 m");
	});

	test("remove the comment of an activity", async ({ page }) => {
		await openActivity(page, footing);
		await title(page).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier activité" });
		await dialog.getByRole("textbox", { name: "Commentaire" }).fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await page.reload();
		await expect(general(page)).toContainText("Dénivelé");
		await expect(general(page)).not.toContainText("Bonnes sensations");
	});

	test("edit the track keeps the points and segments", async ({ page }) => {
		await openActivity(page, track);
		await title(page).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier activité" });
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Fractionné 400");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Fractionné 400" })).toBeVisible();
		await expect(page.locator("table.list").first().locator("tbody tr")).toHaveCount(3);
		await expect(page.locator('input[value="Échauffement"]')).toBeVisible();
	});

	test("delete an activity from its page", async ({ page }) => {
		await openActivity(page, swim);
		await title(page).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer activité" });
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page).toHaveURL(`/sport/${swim.id}`);

		await title(page).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		// The activity page is gone: back to the list
		await expect(page).toHaveURL("/sport/list");
		await expect(page.getByRole("link", { name: swim.name })).toHaveCount(0);
	});
});
