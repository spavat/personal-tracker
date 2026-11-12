import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";
import { createAntennaPodBackup } from "./antennapod";

const { mockPodcast, oldShow, secondPodcast } = SEED.internet;

// One card (AntennaPod listening -> proposed episode) followed by its form, per proposal
function syncCards(page: Page) {
	return page.locator(".sync-list .card_sync_item");
}

function syncForm(page: Page, index: number) {
	return page.locator(".sync-list .sync-item").nth(index);
}

// Lands on step 1: the backup holds a listening of Third Podcast, a feed no program uses
async function uploadBackup(page: Page, path: string) {
	await page.goto("/internet/sync");
	await expect(page.getByRole("heading", { name: "Sync", exact: true })).toBeVisible();
	const send = page.getByRole("button", { name: "Envoyer" });
	await expect(send).toBeDisabled();
	await page.getByLabel("Sauvegarde AntennaPod (.db)").setInputFiles(createAntennaPodBackup(path));
	await send.click();
	await expect(page.getByRole("heading", { name: "Sync — Étape 1 : podcasts inconnus (1)" })).toBeVisible();
}

function feedCard(page: Page, title: string) {
	return page.locator(".sync-feed").filter({ has: page.getByRole("heading", { name: title }) });
}

async function showForms(page: Page, count: number) {
	await expect(page.getByRole("heading", { name: `Sync — Étape 2 : épisodes (${count})` })).toBeVisible();
	// The forms are hidden by default
	await expect(page.locator(".sync-list .sync-item")).toHaveCount(0);
	await page.getByRole("checkbox", { name: "Afficher formulaire" }).check();
	await expect(page.locator(".sync-list .sync-item")).toHaveCount(count);
}

async function ignoreThirdPodcast(page: Page, count: number) {
	await feedCard(page, "Third Podcast").getByRole("button", { name: "Ignorer" }).click();
	await showForms(page, count);
}

test.describe("Internet - Sync", () => {
	test.afterEach(resetDb);

	test("both sources are offered while no sync is in progress", async ({ page }) => {
		await page.goto("/internet/sync");
		await expect(page.getByRole("heading", { name: "Sauvegarde AntennaPod" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "gopodder" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Synchroniser" })).toBeEnabled();
	});

	test("upload an AntennaPod backup creates the proposals", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));

		// Step 1: the unknown feed, with its title and number of episodes
		const third = feedCard(page, "Third Podcast");
		await expect(third.getByRole("heading")).toHaveText("Third Podcast (1 épisode(s))");
		await expect(third).toContainText("https://feeds.example.com/third-podcast.xml");
		await ignoreThirdPodcast(page, 3);

		// Sorted by listening date; finished episodes only
		await expect(syncCards(page).locator(".info")).toHaveText([
			"Mock PodcastPodcast épisode 3",
			"Mock PodcastPodcast épisode 2",
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
		// Known program, unknown episode: nothing to propose
		await expect(syncCards(page).nth(2).locator(".proposition-details")).toBeEmpty();

		await expect(syncForm(page, 0).getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue(
			"Podcast épisode 3",
		);
		await expect(syncForm(page, 1).getByRole("spinbutton", { name: "Durée réelle" })).toHaveValue("36");
	});

	test("validate a proposal adds the episode", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		await ignoreThirdPodcast(page, 3);
		await syncForm(page, 0).getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByRole("heading", { name: "Sync — Étape 2 : épisodes (2)" })).toBeVisible();

		await page.goto(`/internet/${mockPodcast.id}`);
		await expect(page.locator("table.episodes")).toContainText("Podcast épisode 3");
		await expect(page.locator(".presentation .stats")).toContainText("3 épisodes");
	});

	test("link an unknown feed to an existing program", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		const third = feedCard(page, "Third Podcast");
		// Only podcasts are offered
		const select = third.getByRole("combobox", { name: "Programme pour Third Podcast" });
		await expect(select.locator("option")).toHaveText(["", mockPodcast.name, secondPodcast.name]);
		await select.selectOption({ label: secondPodcast.name });
		await third.getByRole("button", { name: "Associer" }).click();

		// A program has a single feed: its previous one (also listened in this backup) is now unknown
		await expect(page.getByRole("heading", { name: "Sync — Étape 1 : podcasts inconnus (1)" })).toBeVisible();
		await feedCard(page, "Second Podcast").getByRole("button", { name: "Ignorer" }).click();
		await showForms(page, 3);

		// The feed now belongs to the program: its proposal is matched
		const card = syncCards(page).nth(2);
		await expect(card.getByRole("link", { name: secondPodcast.name })).toBeVisible();
		await expect(card).toContainText("Third épisode 1");
		await expect(card).toContainText("Durée : 30");
		await syncForm(page, 2).getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByRole("heading", { name: "Sync — Étape 2 : épisodes (2)" })).toBeVisible();

		await page.goto(`/internet/${secondPodcast.id}`);
		await expect(page.locator("table.episodes")).toContainText("Third épisode 1");
	});

	test("create the program of an unknown feed", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		const third = feedCard(page, "Third Podcast");
		await third.getByRole("button", { name: "+ Nouveau" }).click();
		// Prefilled with the feed title, type and url
		await expect(third.getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue("Third Podcast");
		await expect(third.getByRole("combobox", { name: "Type", exact: true })).toHaveValue("podcast");
		await expect(third.locator('input[name="program.refs.0.value"]')).toHaveValue(
			"https://feeds.example.com/third-podcast.xml",
		);
		await third.getByRole("button", { name: "Créer le programme" }).click();
		await showForms(page, 4);

		const card = syncCards(page).nth(2);
		await expect(card.getByRole("link", { name: "Third Podcast" })).toBeVisible();
		await syncForm(page, 2).getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByRole("heading", { name: "Sync — Étape 2 : épisodes (3)" })).toBeVisible();

		await page.goto("/internet/list");
		await page.getByRole("link", { name: "Third Podcast" }).click();
		await expect(page.locator("table.episodes")).toContainText("Third épisode 1");
	});

	test("delete a proposal", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));
		await ignoreThirdPodcast(page, 3);
		await syncForm(page, 2).getByRole("button", { name: "Supprimer" }).click();
		await expect(page.getByRole("heading", { name: "Sync — Étape 2 : épisodes (2)" })).toBeVisible();
		await expect(syncCards(page).locator(".info")).not.toContainText(["Second épisode manquant"]);
	});

	test("reprocess the proposals after adding a feed to a program", async ({ page }, testInfo) => {
		await uploadBackup(page, testInfo.outputPath("antennapod.db"));

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

		// The feed is known again: straight to step 2, the proposal not rebuilt yet
		await page.getByRole("link", { name: "Sync Podcast" }).click();
		await expect(page.getByRole("heading", { name: "Sync — Étape 2 : épisodes (4)" })).toBeVisible();
		await expect(syncCards(page).nth(2).locator(".proposition-details")).toBeEmpty();
		await page.getByRole("button", { name: "Recalculer les propositions" }).click();
		const third = syncCards(page).nth(2);
		await expect(third.getByRole("link", { name: oldShow.name })).toBeVisible();
		await expect(third).toContainText("Durée : 30");
	});

	test("gopodder sync proposes the new listenings, through the same steps", async ({ page }) => {
		await page.goto("/internet/sync");
		await page.getByRole("button", { name: "Synchroniser" }).click();

		// Step 1: the feed title is read from the RSS feed
		await expect(page.getByRole("heading", { name: "Sync — Étape 1 : podcasts inconnus (1)" })).toBeVisible();
		const third = feedCard(page, "Third Podcast");
		await third
			.getByRole("combobox", { name: "Programme pour Third Podcast" })
			.selectOption({ label: secondPodcast.name });
		await third.getByRole("button", { name: "Associer" }).click();

		// Step 2: several plays of one episode merged, the 10 s play dropped
		await showForms(page, 3);
		await expect(syncCards(page).locator(".info")).toHaveText([
			"Mock PodcastPodcast épisode 4",
			"Mock PodcastPodcast épisode 1",
			"Third PodcastThird épisode 2",
		]);
		// Furthest position: half of 35 min, at 20:00 Paris time
		const partial = syncCards(page).nth(0);
		await expect(partial).toContainText("Durée : 18*");
		await expect(partial).toContainText("Date : 10/11/26");
		// Already saved: flagged, still proposed (relistening)
		await expect(syncCards(page).nth(1).getByLabel("Épisode déjà enregistré le 24/10/26")).toBeVisible();
		await expect(syncCards(page).nth(0).locator(".fa-circle-info")).toHaveCount(0);
		await expect(syncCards(page).nth(2).getByRole("link", { name: secondPodcast.name })).toBeVisible();
	});
});
