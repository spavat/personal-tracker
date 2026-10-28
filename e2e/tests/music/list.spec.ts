import type { Locator, Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { discovery, okComputer, nevermind, cross, pulpFiction } = SEED.music;

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function listeningRows(page: Page) {
	return page.locator("table.listenings tbody tr");
}

function listeningRow(page: Page, album: string) {
	return listeningRows(page).filter({ hasText: album });
}

async function openAddModal(page: Page) {
	await page.goto("/music/list/2026-10");
	await page.getByRole("button", { name: "Ajouter une écoute" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter une écoute" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function openEditModal(page: Page, album: string) {
	await page.goto("/music/list/2026-10");
	await listeningRow(page, album).getByRole("button", { name: "Modifier" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier l'écoute" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function fillListening(
	dialog: Locator,
	values: { artist: string; album: string; duration: string; date: string },
) {
	await dialog.locator('input[name="artist.0.value"]').fill(values.artist);
	await dialog.getByRole("textbox", { name: "Album" }).fill(values.album);
	await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill(values.duration);
	await dialog.getByLabel("Date d'écoute").fill(values.date);
}

test.describe("Music - List", () => {
	test.afterEach(resetDb);

	test("list root redirects to the current month", async ({ page }) => {
		await page.goto("/music/list");
		await expect(page).toHaveURL(`/music/list/${currentMonth}`);
	});

	test("list shows the listenings of the month", async ({ page }) => {
		await page.goto("/music/list/2026-10");
		await expect(listeningRows(page)).toHaveCount(3);
		// Same day: the last created first
		await expect(listeningRows(page).nth(0).locator("td")).toHaveText([
			"#1",
			"20/10/2026",
			`${discovery.artist}${discovery.album}`,
			"12/03/2001",
			"61",
			"Electro",
			"",
			" ",
		]);
		await expect(listeningRows(page).nth(1).locator("td").nth(2)).toHaveText(
			`${okComputer.artist}${okComputer.album}`,
		);
		await expect(listeningRows(page).nth(1).locator("td").nth(6)).toHaveText("train");
		await expect(listeningRows(page).nth(2).locator("td").nth(3)).toHaveText("1991");
	});

	test("several artists and an unknown release", async ({ page }) => {
		await page.goto("/music/list/2026-09");
		await expect(listeningRow(page, cross.album).locator("td").nth(2)).toHaveText(`Justice • Mehdi${cross.album}`);

		await page.goto("/music/list/2025-12");
		await expect(listeningRows(page).first().locator("td").nth(3)).toHaveText("????");
	});

	test("an empty month", async ({ page }) => {
		await page.goto("/music/list/2026-08");
		await expect(page.getByText("Aucune écoute trouvée.")).toBeVisible();
	});

	test("navigate between months", async ({ page }) => {
		await page.goto("/music/list/2026-10");
		await page.getByRole("button", { name: "Go to previous" }).click();
		await expect(page).toHaveURL("/music/list/2026-09");
		await expect(listeningRows(page)).toHaveCount(4);

		await page.goto("/music/list/2024-01");
		await expect(page.getByRole("button", { name: "Go to previous" })).toBeDisabled();

		await page.goto(`/music/list/${currentMonth}`);
		await expect(page.getByRole("button", { name: "Go to next" })).toBeDisabled();
	});

	test("add a listening", async ({ page }) => {
		const dialog = await openAddModal(page);
		await fillListening(dialog, {
			artist: "Massive Attack",
			album: "Mezzanine",
			duration: "63",
			date: "2026-10-25",
		});
		// Second artist
		await dialog.getByRole("button", { name: "Ajouter un artiste" }).click();
		await dialog.locator('input[name="artist.1.value"]').fill("Elizabeth Fraser");
		await dialog.getByRole("textbox", { name: "Date (ou année) de release" }).fill("1998-04-20");
		await dialog.getByRole("textbox", { name: "Genre" }).fill("Trip Hop");
		await dialog.getByText("Ajouter un tag").click();
		await dialog.locator('input[name="contextTags.0.value"]').fill("casque");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(listeningRows(page)).toHaveCount(4);
		await expect(listeningRows(page).first().locator("td")).toHaveText([
			"#1",
			"25/10/2026",
			"Massive Attack • Elizabeth FraserMezzanine",
			"20/04/1998",
			"63",
			"Trip Hop",
			"casque",
			" ",
		]);
	});

	test("the add form shows the missing fields", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog.getByText("L'artiste est obligatoire")).toBeVisible();
		await expect(dialog.getByText("L'album est obligatoire")).toBeVisible();
		await expect(listeningRows(page)).toHaveCount(3);
	});

	test("cancel the add modal", async ({ page }) => {
		const dialog = await openAddModal(page);
		await fillListening(dialog, {
			artist: "Massive Attack",
			album: "Mezzanine",
			duration: "63",
			date: "2026-10-25",
		});
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(listeningRows(page)).toHaveCount(3);
	});

	test("paste the Navidrome data", async ({ page }) => {
		const dialog = await openAddModal(page);
		const paste = dialog.getByRole("textbox", { name: "Coller les données de Navidrome" });
		await expect(paste).toBeFocused();
		await paste.fill(
			JSON.stringify({
				listeningDate: "2026-10-26",
				artist: "Portishead • Beth Gibbons",
				album: "Dummy",
				releaseDate: "1994",
				genre: "Trip Hop",
				duration: 49,
			}),
		);
		await expect(dialog.locator('input[name="artist.0.value"]')).toHaveValue("Portishead");
		await expect(dialog.locator('input[name="artist.1.value"]')).toHaveValue("Beth Gibbons");
		await expect(dialog.getByRole("textbox", { name: "Album" })).toHaveValue("Dummy");
		await expect(dialog.getByRole("spinbutton", { name: "Durée (min)" })).toHaveValue("49");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(listeningRows(page).first()).toContainText("Portishead • Beth GibbonsDummy");
	});

	test("invalid Navidrome data is ignored", async ({ page }) => {
		const errors: Array<string> = [];
		page.on("pageerror", (error) => errors.push(error.message));
		const dialog = await openAddModal(page);
		await dialog.getByRole("textbox", { name: "Coller les données de Navidrome" }).fill("not json");
		await expect(dialog.getByRole("textbox", { name: "Album" })).toHaveValue("");
		expect(errors).toEqual([]);
	});

	test("edit a listening", async ({ page }) => {
		const dialog = await openEditModal(page, nevermind.album);
		await expect(dialog.locator('input[name="artist.0.value"]')).toHaveValue(nevermind.artist);
		await expect(dialog.getByRole("textbox", { name: "Album" })).toHaveValue(nevermind.album);

		await dialog.getByRole("textbox", { name: "Album" }).fill("Nevermind (Deluxe)");
		await dialog.getByRole("spinbutton", { name: "Durée (min)" }).fill("80");
		await dialog.getByText("Ajouter un tag").click();
		await dialog.locator('input[name="contextTags.0.value"]').fill("voiture");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		const row = listeningRow(page, "Nevermind (Deluxe)");
		await expect(row.locator("td").nth(4)).toHaveText("80");
		await expect(row.locator("td").nth(6)).toHaveText("voiture");
	});

	test("remove the context tag of a listening", async ({ page }) => {
		const dialog = await openEditModal(page, okComputer.album);
		await expect(dialog.locator('input[name="contextTags.0.value"]')).toHaveValue("train");
		await dialog.locator(".badge-edit span", { hasText: "✕" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(listeningRow(page, okComputer.album).locator("td").nth(6)).toHaveText("");
		await page.reload();
		await expect(listeningRow(page, okComputer.album).locator("td").nth(6)).toHaveText("");
	});

	test("delete a listening", async ({ page }) => {
		await page.goto("/music/list/2026-10");
		await listeningRow(page, discovery.album).getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer une écoute" });
		await expect(dialog).toContainText(`Artiste : ${discovery.artist}`);
		await expect(dialog).toContainText(`Album : ${discovery.album}`);

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(listeningRows(page)).toHaveCount(3);

		await listeningRow(page, discovery.album).getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(listeningRows(page)).toHaveCount(2);
		await expect(listeningRow(page, discovery.album)).toHaveCount(0);
	});

	test("ctrl+shift+n opens the add modal", async ({ page }) => {
		await page.goto("/music/list/2026-10");
		await expect(listeningRows(page)).toHaveCount(3);
		await page.keyboard.press("Control+Shift+N");
		await expect(page.getByRole("dialog", { name: "Ajouter une écoute" })).toBeVisible();
	});

	test("search an album and listen to it again", async ({ page }) => {
		await page.goto("/music/list/2026-10");
		// The shortcut is listened once the page is loaded
		await expect(listeningRows(page)).toHaveCount(3);
		await page.keyboard.press("Control+Shift+F");
		const search = page.getByPlaceholder("Recherche");
		await expect(search).toBeFocused();

		// Listened twice: a single result
		await search.fill("radiohead");
		await expect(page.locator(".search .result-item")).toHaveCount(2);
		await search.fill("justice");
		await expect(page.locator(".search .result-item")).toHaveText([/Justice, Mehdi\s*Cross/]);

		await search.fill("pulp");
		await page.locator(".search .result-item").first().click();
		const dialog = page.getByRole("dialog", { name: "Ajouter une écoute" });
		await expect(dialog.locator('input[name="artist.0.value"]')).toHaveValue(pulpFiction.artist);
		await expect(dialog.getByRole("textbox", { name: "Album" })).toHaveValue(pulpFiction.album);
		await expect(dialog.getByRole("spinbutton", { name: "Durée (min)" })).toHaveValue("41");
		await dialog.getByLabel("Date d'écoute").fill("2026-10-26");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(listeningRows(page).first()).toContainText(pulpFiction.album);
	});
});
