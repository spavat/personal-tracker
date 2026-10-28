import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";
import { createAntennaPodBackup } from "./antennapod";

const { mockPodcast, oldShow } = SEED.internet;

// One card (AntennaPod listening -> proposed episode) followed by its form, per proposal
function syncCards(page: Page) {
	return page.locator(".sync-list .card_sync_item");
}

function syncForm(page: Page, index: number) {
	return page.locator(".sync-list .sync-item").nth(index);
}

async function uploadBackup(page: Page, path: string) {
	await page.goto("/internet/sync");
	await expect(page.getByRole("heading", { name: "Sync", exact: true })).toBeVisible();
	const send = page.getByRole("button", { name: "Envoyer" });
	await expect(send).toBeDisabled();
	await page.getByLabel("Sauvegarde AntennaPod (.db)").setInputFiles(createAntennaPodBackup(path));
	await send.click();
	await expect(page.getByRole("heading", { name: "Sync (4)" })).toBeVisible();
}

test.describe("Internet - Sync", () => {
	test.afterEach(resetDb);

	test("upload an AntennaPod backup creates the proposals", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));

		// Sorted by listening date; finished episodes only
		await expect(syncCards(page).locator(".info")).toHaveText([
			"Mock PodcastPodcast épisode 3",
			"Mock PodcastPodcast épisode 2",
			"Third PodcastThird épisode 1",
			"Second PodcastSecond épisode manquant",
		]);

		// Matched with the RSS feed of a program
		const first = syncCards(page).nth(0);
		await expect(first.getByRole("link", { name: mockPodcast.name })).toBeVisible();
		await expect(first).toContainText("Durée : 50");
		await expect(first).toContainText("Date : 25/10/26");
		// Listened at 60%, at 3:30 Paris time: real duration and previous day
		const second = syncCards(page).nth(1);
		await expect(second).toContainText("Durée : 36*");
		await expect(second).toContainText("Date : 25/10/26");
		// Unknown feed, unknown episode: nothing to propose
		await expect(syncCards(page).nth(2)).toContainText("?");
		await expect(syncCards(page).nth(3)).toContainText("?");

		await expect(syncForm(page, 0).getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue(
			"Podcast épisode 3",
		);
		await expect(syncForm(page, 1).getByRole("spinbutton", { name: "Durée réelle" })).toHaveValue("36");
	});

	test("validate a proposal adds the episode", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		await syncForm(page, 0).getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByRole("heading", { name: "Sync (3)" })).toBeVisible();

		await page.goto(`/internet/${mockPodcast.id}`);
		await expect(page.locator("table.episodes")).toContainText("Podcast épisode 3");
		await expect(page.locator(".presentation .stats")).toContainText("3 épisodes");
	});

	test("validate a proposal without program into an existing one", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		const form = syncForm(page, 2);
		await form.locator('select[name="programId"]').selectOption({ label: oldShow.name });
		await form.getByRole("spinbutton", { name: "Durée *" }).fill("20");
		await form.getByRole("combobox", { name: "Type *" }).selectOption("podcast");
		await form.getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByRole("heading", { name: "Sync (3)" })).toBeVisible();

		await page.goto(`/internet/${oldShow.id}`);
		await expect(page.locator("table.episodes")).toContainText("Third épisode 1");
	});

	test("validate a proposal into a new program", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		const form = syncForm(page, 2);
		await form.getByRole("button", { name: "+ Nouveau" }).click();
		// The program form comes first, then the episode form
		await form.getByRole("textbox", { name: "Titre *", exact: true }).first().fill("Third Podcast");
		await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("podcast");
		await form.getByRole("spinbutton", { name: "Durée *" }).fill("20");
		await form.getByRole("combobox", { name: "Type *" }).selectOption("podcast");
		await form.getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByRole("heading", { name: "Sync (3)" })).toBeVisible();

		await page.goto("/internet/list");
		await page.getByRole("link", { name: "Third Podcast" }).click();
		await expect(page.locator("table.episodes")).toContainText("Third épisode 1");
	});

	test("delete a proposal", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		await syncForm(page, 3).getByRole("button", { name: "Supprimer" }).click();
		await expect(page.getByRole("heading", { name: "Sync (3)" })).toBeVisible();
		await expect(syncCards(page).locator(".info")).not.toContainText(["Second épisode manquant"]);
	});

	test("reprocess the proposals after adding a feed to a program", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		await expect(syncCards(page).nth(2)).toContainText("?");

		// Old Show now uses the feed of the unmatched listening
		await page.goto(`/internet/${oldShow.id}`);
		await page.getByRole("heading", { name: oldShow.name }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier programme" });
		await dialog.getByRole("combobox", { name: "Type" }).selectOption("podcast");
		await dialog.getByRole("button", { name: "Ajouter une référence" }).click();
		await dialog.locator('select[name="program.refs.0.key"]').selectOption("rss");
		await dialog.locator('input[name="program.refs.0.value"]').fill("https://feeds.example.com/third-podcast.xml");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await page.getByRole("link", { name: "Sync Podcast" }).click();
		await page.getByRole("button", { name: "Recalculer les propositions" }).click();
		const third = syncCards(page).nth(2);
		await expect(third.getByRole("link", { name: oldShow.name })).toBeVisible();
		await expect(third).toContainText("Durée : 30");
		await expect(page.getByRole("heading", { name: "Sync (4)" })).toBeVisible();
	});
});
