import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { mockPodcast, mockTube } = SEED.internet;

function episodeRows(page: Page) {
	// Each episode has a hidden second row (created date, link) toggled by its first cell
	return page.locator("table.episodes tbody tr").filter({ has: page.getByRole("button", { name: "Modifier" }) });
}

function episodeRow(page: Page, name: string) {
	return episodeRows(page).filter({ hasText: name });
}

async function openProgram(page: Page, program: { id: string; name: string }) {
	await page.goto(`/internet/${program.id}`);
	await expect(page.getByRole("heading", { name: program.name })).toBeVisible();
}

test.describe("Internet - Program details", () => {
	test.afterEach(resetDb);

	test("details page shows the program and its episodes", async ({ page }) => {
		await openProgram(page, mockPodcast);
		const general = page.locator(".presentation .general");
		await expect(general).toContainText("par : Pod Caster");
		await expect(general).toContainText("Réseau : Mock Radio");
		await expect(general).toContainText("Type :");
		await expect(general).toContainText("podcast");
		await expect(general).toContainText("science");
		await expect(page.locator(".presentation .description")).toHaveText("Un podcast de test");

		const stats = page.locator(".presentation .stats");
		await expect(stats).toContainText("2 épisodes");
		await expect(stats).toContainText("Durée moyenne : 43min");
		// (40 + 30 real) / (40 + 45)
		await expect(stats).toContainText("Taux de complétion : 82%");
		await expect(stats).toContainText("24/10/26");

		await expect(episodeRows(page).locator("td:nth-child(4)")).toHaveText([
			/^Podcast épisode 1/,
			/^Podcast épisode 0/,
		]);
		const first = episodeRows(page).first().locator("td");
		await expect(first.nth(2)).toHaveText("24/10/26");
		await expect(first.nth(3)).toContainText("metro");
		await expect(first.nth(4)).toHaveText("30min*");
	});

	test("the first cell toggles the episode second row", async ({ page }) => {
		await openProgram(page, mockTube);
		const row = episodeRow(page, "Mock video 1");
		await expect(row.locator(".fa-circle-info")).toBeVisible();
		await expect(row).toContainText("tuto");

		await row.locator("td").first().click();
		const link = page.getByRole("link", { name: "https://www.youtube.com/watch?v=vid00000001" });
		await expect(link).toBeVisible();
		await row.locator("td").first().click();
		await expect(link).not.toBeVisible();
	});

	test("edit the program", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await page.getByRole("heading", { name: mockPodcast.name }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier programme" });
		await expect(dialog).toBeVisible();
		await expect(dialog.locator('input[name="program.refs.0.value"]')).toHaveValue(
			"https://feeds.example.com/mock-podcast.xml",
		);
		await expect(dialog.locator('input[name="program.tags.0.value"]')).toHaveValue("science");

		await dialog.getByRole("textbox", { name: "Titre court" }).fill("MP");
		await dialog.getByRole("textbox", { name: "Description" }).fill("Nouvelle description");
		await dialog.getByText("Ajouter un tag").click();
		await dialog.locator('input[name="program.tags.1.value"]').fill("histoire");
		await dialog.getByRole("button", { name: "Ajouter un lien" }).click();
		await dialog.locator('input[name="program.links.0.value"]').fill("https://mock-radio.example.com/podcast");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: mockPodcast.name })).toContainText("(MP)");
		await expect(page.locator(".presentation .description")).toHaveText("Nouvelle description");
		await expect(page.locator(".presentation .general")).toContainText("histoire");
		await expect(page.getByRole("link", { name: "example.com" })).toHaveAttribute(
			"href",
			"https://mock-radio.example.com/podcast",
		);
	});

	test("edit an episode", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await episodeRow(page, "Podcast épisode 0").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("textbox", { name: "Titre *", exact: true })).toHaveValue("Podcast épisode 0");
		await expect(dialog.getByRole("spinbutton", { name: "Durée *" })).toHaveValue("40");

		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Podcast épisode zéro");
		await dialog.getByRole("spinbutton", { name: "Durée réelle" }).fill("25");
		await dialog.getByRole("textbox", { name: "Commentaire" }).fill("Pas fini");
		await dialog.getByText("Ajouter un tag").first().click();
		await dialog.locator('input[name="episode.tags.0.value"]').fill("intro");
		await dialog.getByText("Ajouter un tag").last().click();
		await dialog.locator('input[name="episode.contextTags.0.value"]').fill("velo");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		const row = episodeRow(page, "Podcast épisode zéro");
		await expect(row.locator("td").nth(3)).toContainText("intro");
		await expect(row.locator("td").nth(3)).toContainText("velo");
		await expect(row.locator(".fa-circle-info")).toBeVisible();
		await expect(row.locator("td").nth(4)).toHaveText("25min*");
	});

	test("clear the real duration and the context tags of an episode", async ({ page }) => {
		await openProgram(page, mockPodcast);
		const row = episodeRow(page, "Podcast épisode 1");
		await expect(row.locator("td").nth(3)).toContainText("metro");
		await expect(row.locator("td").nth(4)).toHaveText("30min*");

		await row.getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await dialog.getByRole("spinbutton", { name: "Durée réelle" }).clear();
		await dialog.locator(".badge-edit span", { hasText: "✕" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row.locator("td").nth(3)).not.toContainText("metro");
		await expect(row.locator("td").nth(4)).toHaveText("45min");
	});

	test("delete an episode", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await episodeRow(page, "Podcast épisode 0").getByRole("button", { name: "Supprimer" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer épisode" });
		await expect(dialog).toContainText("Podcast épisode 0");

		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(episodeRows(page)).toHaveCount(2);

		await episodeRow(page, "Podcast épisode 0").getByRole("button", { name: "Supprimer" }).click();
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(episodeRows(page)).toHaveCount(1);
		await expect(page.locator(".presentation .stats")).toContainText("1 épisodes");
	});

	test("search a program with ctrl+shift+f", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await page.keyboard.press("Control+Shift+F");
		const search = page.getByPlaceholder("Recherche");
		await expect(search).toBeFocused();
		await search.fill("tube");
		await expect(page.locator(".search .result-item")).toHaveCount(1);
		await page.keyboard.press("Enter");

		await expect(page).toHaveURL(`/internet/${mockTube.id}`);
		await expect(page.getByRole("heading", { name: mockTube.name })).toBeVisible();
	});

	test("ctrl+shift+n opens the add episode modal", async ({ page }) => {
		await openProgram(page, mockTube);
		await page.keyboard.press("Control+Shift+N");
		await expect(page.getByRole("dialog", { name: "Ajouter épisode" })).toBeVisible();
	});
});
