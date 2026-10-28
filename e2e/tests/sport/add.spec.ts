import type { Page } from "@playwright/test";

import { expect, resetDb, test } from "../../fixtures";
import { buildGpx } from "./gpx";

const API_URL = "http://localhost:3001";

function activityRow(page: Page, name: string) {
	return page.locator("table.activities tbody tr").filter({ has: page.getByRole("link", { name, exact: true }) });
}

async function openAddModal(page: Page) {
	await page.goto("/sport/list");
	await page.getByRole("button", { name: "Ajouter une activité" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter activité" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Sport - Add an activity", () => {
	test.afterEach(resetDb);

	test("add an activity by hand", async ({ page }) => {
		const dialog = await openAddModal(page);
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue("Course à pied");
		await expect(dialog.getByRole("combobox", { name: "Type" })).toHaveValue("running");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Vélotaf");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption({ label: "Cyclisme" });
		await dialog.getByLabel("Date").fill("2026-10-26T08:15");
		await dialog.getByRole("spinbutton", { name: "Distance (km)" }).fill("8.5");
		await dialog.getByRole("spinbutton", { name: "Temps total (min)" }).fill("30");
		await dialog.getByRole("spinbutton", { name: "Temps en mouvement (min)" }).fill("28");
		await dialog.getByRole("spinbutton", { name: "Allure (min/km)" }).fill("3.53");
		await dialog.getByRole("textbox", { name: "Commentaire" }).fill("Vent de face");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(activityRow(page, "Vélotaf").locator("td")).toHaveText([
			"1",
			"26/10/2026",
			"Vélotaf",
			"Cyclisme",
			"8.5 km",
			"30min",
			"3:32 /km",
			"\u00a0",
		]);
		await page.getByRole("link", { name: "Vélotaf" }).click();
		await expect(page.locator(".presentation .general")).toContainText("Vent de face");
	});

	test("the add form shows the missing fields", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption({ label: "Sélectionner un type" });
		await dialog.getByRole("spinbutton", { name: "Distance (km)" }).fill("");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await expect(dialog.getByText("Le type est obligatoire")).toBeVisible();
		await expect(dialog.getByText("La date est obligatoire sans fichier GPX")).toBeVisible();
		await expect(dialog.getByText("La distance est obligatoire")).toBeVisible();
	});

	test("an activity without date is refused, the list keeps working", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Sans date");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("La date est obligatoire sans fichier GPX")).toBeVisible();

		await page.goto("/sport/list");
		await expect(page.locator("table.activities tbody tr")).toHaveCount(5);
	});

	test("import a GPX file", async ({ page, request }, testInfo) => {
		const gpxPath = testInfo.outputPath("course.gpx");
		const { writeFileSync } = await import("node:fs");
		writeFileSync(gpxPath, buildGpx());

		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Course GPX");
		await dialog.locator('input[type="file"]').setInputFiles(gpxPath);
		await expect(dialog.locator(".gpx-drop-zone")).toContainText("course.gpx");
		await expect(dialog.getByText("Distance, temps et allure seront extraits du fichier GPX.")).toBeVisible();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		// Details and date (Paris time) come from the file: 60 intervals of 30 m and 10 s
		await expect(activityRow(page, "Course GPX").locator("td")).toHaveText([
			"1",
			"25/10/2026",
			"Course GPX",
			"Course à pied",
			"1.8 km",
			"10min",
			"5:34 /km",
			"\u00a0",
		]);

		await page.getByRole("link", { name: "Course GPX" }).click();
		await expect(page).toHaveURL(/\/sport\/[0-9a-f-]{36}$/);
		const id = page.url().split("/").pop()!;
		const general = page.locator(".presentation .general");
		await expect(general).toContainText("Dénivelé positif : 30 m");
		await expect(page.locator(".leaflet-container")).toBeVisible();
		await expect(page.getByRole("button", { name: "Télécharger le fichier GPX" })).toBeVisible();

		// The GPX file is stored in S3, behind a signed URL
		const download = await request.get(`${API_URL}/sport/download?id=${id}`, { maxRedirects: 0 });
		expect(download.status()).toBe(302);
		const fileUrl = download.headers().location;
		const file = await request.get(fileUrl);
		expect(file.status()).toBe(200);
		expect(await file.text()).toContain("<name>Course GPX</name>");

		// So is its thumbnail
		await page.goto("/sport/history/2026-10");
		const thumbnail = page.locator(".card_item").filter({ hasText: "Course GPX" }).locator("img");
		await expect(thumbnail).toHaveAttribute("src", `${API_URL}/images/sport/${id}/thumbnail`);
		await expect.poll(() => thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(480);

		// Deleting the activity deletes its files
		await page.goto(`/sport/${id}`);
		await page.locator(".presentation .title").getByRole("button", { name: "Supprimer" }).click();
		await page
			.getByRole("dialog", { name: "Supprimer activité" })
			.getByRole("button", { name: "Supprimer" })
			.click();
		await expect(page).toHaveURL("/sport/list");
		expect((await request.get(fileUrl)).status()).toBe(404);
		expect((await request.get(`${API_URL}/images/sport/${id}/thumbnail`)).status()).toBe(404);
	});

	test("remove the GPX file before saving", async ({ page }, testInfo) => {
		const gpxPath = testInfo.outputPath("course.gpx");
		const { writeFileSync } = await import("node:fs");
		writeFileSync(gpxPath, buildGpx());

		const dialog = await openAddModal(page);
		await dialog.locator('input[type="file"]').setInputFiles(gpxPath);
		await dialog.locator(".gpx-drop-zone").getByTitle("Supprimer").click();
		await expect(dialog.locator(".gpx-drop-zone")).toContainText("Glisser-déposer un fichier GPX");
		await expect(dialog.getByText("Distance, temps et allure seront extraits du fichier GPX.")).toHaveCount(0);
	});
});
