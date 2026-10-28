import type { Locator, Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

// External pages and feeds are served by e2e/mocks/fetch-mock.mjs (fixtures in e2e/mocks/responses)
const { mockPodcast, mockTube, tourDeFrance, greatShow } = SEED.internet;

async function openAddModal(page: Page, program?: { id: string; name: string }) {
	if (program) {
		await page.goto(`/internet/${program.id}`);
		await page.getByRole("button", { name: "Ajouter un épisode" }).click();
	} else {
		// The history FAB adds an episode without program (the list one adds a program)
		await page.goto("/internet/history/2026-10");
		await page.getByRole("button", { name: "Ajouter un programme" }).click();
	}
	const dialog = page.getByRole("dialog", { name: "Ajouter épisode" });
	await expect(dialog).toBeVisible();
	return dialog;
}

// "Accès rapide": the latest episodes of the program, from its RSS or Youtube feed (5 at most)
function latestEpisodes(dialog: Locator) {
	return dialog.locator(".latest li");
}

function episodeField(dialog: Locator, name: string) {
	return dialog.locator(".form_part_1").getByRole(name.startsWith("Durée") ? "spinbutton" : "textbox", {
		name,
		exact: true,
	});
}

async function extract(dialog: Locator, url: string) {
	await dialog.locator("#new-link").fill(url);
	await dialog.getByRole("button", { name: "Extraire" }).click();
}

test.describe("Internet - Add episode", () => {
	test.afterEach(resetDb);

	test("pick a latest episode from the RSS feed", async ({ page }) => {
		const dialog = await openAddModal(page, mockPodcast);
		await expect(latestEpisodes(dialog).locator(".titleName")).toHaveText([
			"Podcast épisode 4",
			"Podcast épisode 3",
			"Podcast épisode 2",
			"Podcast épisode 1",
		]);
		await expect(dialog.getByPlaceholder("Recherche dans 4 épisodes")).toBeVisible();

		await dialog.getByPlaceholder("Recherche dans 4 épisodes").fill("3");
		await expect(latestEpisodes(dialog).locator(".titleName")).toHaveText(["Podcast épisode 3"]);
		await latestEpisodes(dialog).getByText("Podcast épisode 3").click();

		await expect(episodeField(dialog, "Titre *")).toHaveValue("Podcast épisode 3");
		await expect(episodeField(dialog, "Durée *")).toHaveValue("50");
		await expect(dialog.getByRole("combobox", { name: "Type *" })).toHaveValue("podcast");
		await expect(episodeField(dialog, "Lien")).toHaveValue("https://feeds.example.com/mock-pod-3");
		await expect(episodeField(dialog, "Id externe")).toHaveValue("mock-pod-3");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.locator("table.episodes")).toContainText("Podcast épisode 3");
		await expect(page.locator(".presentation .stats")).toContainText("3 épisodes");
	});

	test("pick a latest Youtube video: its duration comes from the video page", async ({ page }) => {
		const dialog = await openAddModal(page, mockTube);
		// The feed has 6 videos, only the 5 latest are shown
		await expect(dialog.getByPlaceholder("Recherche dans 6 épisodes")).toBeVisible();
		await expect(latestEpisodes(dialog)).toHaveCount(5);
		await expect(latestEpisodes(dialog).first()).toContainText("Mock video 6");

		// "Mock video 1" was already seen
		await dialog.getByPlaceholder("Recherche dans 6 épisodes").fill("video 1");
		await expect(latestEpisodes(dialog).locator(".fa-circle-check")).toBeVisible();
		await dialog.getByPlaceholder("Recherche dans 6 épisodes").clear();

		await latestEpisodes(dialog).getByText("Mock video 6").click();
		await expect(episodeField(dialog, "Titre *")).toHaveValue("Mock video 6");
		// The feed has no duration: the video page gives 754s
		await expect(episodeField(dialog, "Durée *")).toHaveValue("13");
		await expect(episodeField(dialog, "Lien")).toHaveValue("https://www.youtube.com/watch?v=vid00000006");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.locator("table.episodes")).toContainText("Mock video 6");
	});

	test("refresh the latest episodes of a ref", async ({ page }) => {
		const dialog = await openAddModal(page, mockTube);
		await expect(latestEpisodes(dialog)).toHaveCount(5);

		await dialog.locator(".button-youtubeChannelId").click();
		await expect(dialog.locator(".tooltip-youtubeChannelId")).toContainText("Dernier refresh");
		await expect(latestEpisodes(dialog)).toHaveCount(5);
	});

	test("extract a Youtube link suggests the matching program", async ({ page }) => {
		const dialog = await openAddModal(page);
		await extract(dialog, "https://www.youtube.com/watch?v=vid00000006&t=42");

		await expect(episodeField(dialog, "Titre *")).toHaveValue("Mock video 6");
		await expect(episodeField(dialog, "Durée *")).toHaveValue("13");
		await expect(dialog.getByRole("combobox", { name: "Type *" })).toHaveValue("video");
		await expect(episodeField(dialog, "Id externe")).toHaveValue("vid00000006");

		await dialog.locator(".directLink").getByText(mockTube.name).click();
		await expect(dialog.locator('select[name="programId"]')).toHaveValue(mockTube.id);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await page.goto(`/internet/${mockTube.id}`);
		await expect(page.locator("table.episodes")).toContainText("Mock video 6");
	});

	test("extract a france.tv link suggests the program found by its link", async ({ page }) => {
		const dialog = await openAddModal(page);
		await extract(dialog, "https://www.france.tv/sport/cyclisme/tour-de-france/7000001-etape-15.html");

		await expect(episodeField(dialog, "Titre *")).toHaveValue("Étape 15 : Montpellier - Mont Ventoux");
		await expect(episodeField(dialog, "Durée *")).toHaveValue("253");
		await expect(episodeField(dialog, "Id externe")).toHaveValue("7000001");

		await dialog.locator(".directLink").getByText(tourDeFrance.name).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await page.goto(`/internet/${tourDeFrance.id}`);
		await expect(page.locator("table.episodes")).toContainText("Étape 15 : Montpellier - Mont Ventoux");
	});

	test("create the program of an extracted video", async ({ page }) => {
		const dialog = await openAddModal(page);
		await extract(dialog, "https://www.youtube.com/watch?v=newvideo001");
		await expect(episodeField(dialog, "Titre *")).toHaveValue("New channel video");
		// No program uses this channel yet
		await expect(dialog.locator(".directLink li")).toHaveCount(0);

		await dialog.getByTitle("Ajouter un nouveau programme").click();
		const programPanel = dialog.locator(".form_part_2");
		await expect(programPanel.getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue("New Channel");
		await expect(programPanel.getByRole("textbox", { name: "Description" })).toHaveValue("Une nouvelle chaine");
		await expect(programPanel.getByRole("combobox", { name: "Type" })).toHaveValue("youtube");
		await expect(programPanel.locator('select[name="program.refs.0.key"]')).toHaveValue("youtubeChannelId");
		await expect(programPanel.locator('input[name="program.refs.0.value"]')).toHaveValue(
			"UCnewchannel000000000001",
		);
		await expect(programPanel.locator('input[name="program.links.0.value"]')).toHaveValue(
			"http://www.youtube.com/@newchannel",
		);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await page.getByRole("link", { name: "New Channel" }).click();
		await expect(page.getByRole("heading", { name: "New Channel" })).toBeVisible();
		await expect(page.locator("table.episodes")).toContainText("New channel video");
		await expect(page.locator("img.program-profile")).toHaveJSProperty("naturalWidth", 200);
	});

	test("the latest episodes of a new program can be fetched from its ref", async ({ page }) => {
		const dialog = await openAddModal(page);
		await dialog.getByTitle("Ajouter un nouveau programme").click();
		const programPanel = dialog.locator(".form_part_2");
		await programPanel.getByRole("button", { name: "Ajouter une référence" }).click();
		await programPanel.locator('select[name="program.refs.0.key"]').selectOption("rss");
		await programPanel
			.locator('input[name="program.refs.0.value"]')
			.fill("https://feeds.example.com/third-podcast.xml");
		await programPanel.getByRole("button", { name: "Fetch RSS" }).click();

		await expect(latestEpisodes(dialog).locator(".titleName")).toHaveText(["Third épisode 2", "Third épisode 1"]);
	});

	test("a feed with a single episode", async ({ page }) => {
		const dialog = await openAddModal(page, SEED.internet.secondPodcast);
		await expect(latestEpisodes(dialog).locator(".titleName")).toHaveText(["Second épisode 2"]);
	});

	test("an episode needs a title and a duration", async ({ page }) => {
		const dialog = await openAddModal(page, greatShow);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).toBeVisible();

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(page.locator(".presentation .stats")).toContainText("2 épisodes");
	});
});
