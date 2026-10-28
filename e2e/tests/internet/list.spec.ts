import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { mockPodcast, mockTube, tourDeFrance, greatShow, secondPodcast, oldShow } = SEED.internet;

function programRows(page: Page) {
	return page.locator("table.programs tbody tr");
}

// Second column holds the program name
function programNames(page: Page) {
	return programRows(page).locator("td:nth-child(2)");
}

async function openAddModal(page: Page) {
	await page.goto("/internet/list");
	await page.getByRole("button", { name: "Ajouter un programme" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter programme" });
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Internet - List", () => {
	test.afterEach(resetDb);

	test("list shows the seeded programs, latest episode first", async ({ page }) => {
		await page.goto("/internet/list");
		await expect(programNames(page)).toHaveText([
			mockPodcast.name,
			mockTube.name,
			tourDeFrance.name,
			greatShow.name,
			secondPodcast.name,
			oldShow.name,
		]);

		const cells = programRows(page).first().locator("td");
		await expect(cells.nth(2)).toHaveText("Pod Caster");
		await expect(cells.nth(3)).toHaveText("Mock Radio");
		await expect(cells.nth(4).locator(".fi-fr")).toBeAttached();
		await expect(cells.nth(5).locator(".fa-rss")).toBeVisible();
		await expect(cells.nth(5)).toContainText("https://feeds.example.com/mock-podcast.xml");
		await expect(cells.nth(6)).toHaveText("24/10/2026");
		await expect(cells.nth(7)).toHaveText("2");
		await expect(cells.nth(8)).toHaveText("1h 25min");
		await expect(cells.nth(9)).toHaveText("science");

		await expect(programRows(page).nth(1).locator("td").nth(5).locator(".fa-youtube")).toBeVisible();
	});

	test("sort by program name", async ({ page }) => {
		await page.goto("/internet/list");
		const header = page.getByRole("columnheader", { name: "Programme" });
		await header.getByText("Programme").click();
		await expect(header.locator(".fa-sort-up")).toBeVisible();
		await expect(programNames(page)).toHaveText([
			mockPodcast.name,
			mockTube.name,
			oldShow.name,
			secondPodcast.name,
			greatShow.name,
			tourDeFrance.name,
		]);

		await header.getByText("Programme").click();
		await expect(header.locator(".fa-sort-down")).toBeVisible();
		await expect(programNames(page).first()).toHaveText(tourDeFrance.name);
	});

	test("click a program opens its details", async ({ page }) => {
		await page.goto("/internet/list");
		await page.getByRole("link", { name: tourDeFrance.name }).click();
		await expect(page).toHaveURL(`/internet/${tourDeFrance.id}`);
		await expect(page.getByRole("heading", { name: tourDeFrance.name })).toBeVisible();
	});

	test("add a Youtube program: its images are fetched and stored", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("New Channel");
		await dialog.getByRole("textbox", { name: "Auteur" }).fill("New Author");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption("youtube");
		await dialog.getByRole("button", { name: "Ajouter un lien" }).click();
		await dialog.locator('input[name="program.links.0.value"]').fill("https://www.youtube.com/@newchannel");
		await dialog.getByText("Ajouter un tag").click();
		await dialog.locator('input[name="program.tags.0.value"]').fill("nouveau");
		await dialog.getByRole("button", { name: "Ajouter une référence" }).click();
		await dialog.locator('select[name="program.refs.0.key"]').selectOption("youtubeChannelId");
		await dialog.locator('input[name="program.refs.0.value"]').fill("UCnewchannel000000000001");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const row = programRows(page).filter({ hasText: "New Channel" });
		await expect(row.locator(".fa-youtube")).toBeVisible();
		await expect(row).toContainText("nouveau");
		// Profile and banner were found from the Youtube channel page
		await expect(row.locator(".fa-circle-user")).not.toHaveClass(/disabled/);
		await expect(row.locator(".fa-users-rectangle")).not.toHaveClass(/disabled/);

		await row.getByRole("link", { name: "New Channel" }).click();
		await expect(page.getByRole("heading", { name: "New Channel" })).toBeVisible();
		// Images are resized then served back from S3 by the server
		await expect(page.locator("img.program-profile")).toHaveJSProperty("naturalWidth", 200);
		await expect(page.locator("img.program-banner")).toHaveJSProperty("naturalWidth", 2500);
	});

	test("program title and type are required", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).toBeVisible();

		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("No Type");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).toBeVisible();

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(programRows(page)).toHaveCount(6);
	});

	test("edit a program from the list", async ({ page }) => {
		await page.goto("/internet/list");
		await programRows(page).filter({ hasText: greatShow.name }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier programme" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue(greatShow.name);
		await expect(dialog.getByRole("textbox", { name: "Auteur" })).toHaveValue("John Doe");

		await dialog.getByRole("textbox", { name: "Auteur" }).fill("Jane Doe");
		await dialog.getByRole("textbox", { name: "Réseau" }).fill("Great Network");
		await dialog.getByRole("combobox", { name: "Type" }).selectOption("media");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		const row = programRows(page).filter({ hasText: greatShow.name });
		await expect(row.locator("td").nth(2)).toHaveText("Jane Doe");
		await expect(row.locator("td").nth(3)).toHaveText("Great Network");
	});

	test("cancel the add modal", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Cancelled");
		await dialog.getByRole("button", { name: "Annuler" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(programRows(page)).toHaveCount(6);
	});
});
