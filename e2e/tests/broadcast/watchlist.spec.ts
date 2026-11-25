import type { Page } from "@playwright/test";

import { expect, queryDb, resetDb, SEED, test } from "../../fixtures";

// External feeds are served by e2e/mocks/fetch-mock.mjs (fixtures in e2e/mocks/responses)
const { mockPodcast } = SEED.broadcast;

const episodeOf = async (externalId: string) =>
	(
		await queryDb("SELECT status FROM broadcast.episode WHERE program_id = $1 AND external_id = $2", [
			mockPodcast.id,
			externalId,
		])
	)[0];

async function planFromLatest(page: Page, title: string) {
	await page.goto(`/broadcast/${mockPodcast.id}`);
	await page.getByRole("button", { name: "Ajouter un épisode" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter épisode" });
	const item = dialog.locator(".latest li").filter({ hasText: title });
	await item.getByRole("button", { name: `Ajouter « ${title} » à la liste` }).click();
	// planned: flagged, the button gone
	await expect(item.locator(".fa-bookmark.fa-solid")).toBeVisible();
	await expect(item.getByRole("button", { name: /à la liste/ })).toHaveCount(0);
	// "Podcast épisode 1" has a view: it can't be added
	await expect(
		dialog
			.locator(".latest li")
			.filter({ hasText: "Podcast épisode 1" })
			.getByRole("button", { name: /à la liste/ }),
	).toHaveCount(0);
	await dialog.getByRole("button", { name: "Annuler" }).click();
}

test.describe("Broadcast - Watchlist", () => {
	test.afterEach(resetDb);

	test("a latest episode added to the list, then watched from the « À voir » page", async ({ page }) => {
		await planFromLatest(page, "Podcast épisode 3");
		expect(await episodeOf("mock-pod-3")).toEqual({ status: "planned" });

		await page.goto("/broadcast/watchlist");
		const rows = page.locator("table.watchlist tbody tr");
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText(mockPodcast.name);
		await expect(rows.first()).toContainText("Podcast épisode 3");
		await expect(rows.first()).toContainText("25/10/26");
		await expect(rows.first().locator(".episode-cover img")).toBeVisible();

		// a view takes it off the list: the feed program gets its line
		await rows.first().getByRole("button", { name: "Vu", exact: true }).click();
		await expect(page.getByText("Aucun épisode à voir")).toBeVisible();
		expect(await episodeOf("mock-pod-3")).toEqual({ status: null });
		await page.goto(`/broadcast/${mockPodcast.id}`);
		await expect(page.locator("table.episodes")).toContainText("Podcast épisode 3");
	});

	test("taken off the list, a feed program's episode never watched goes", async ({ page }) => {
		await planFromLatest(page, "Podcast épisode 4");

		await page.goto("/broadcast/watchlist");
		await page.locator("table.watchlist tbody tr").first().getByRole("button", { name: "Retirer" }).click();
		await expect(page.getByText("Aucun épisode à voir")).toBeVisible();
		expect(await episodeOf("mock-pod-4")).toBeUndefined();
	});

	test("a catalog: an ignored release left out of the progress, a planned one watched", async ({ page }) => {
		await page.goto(`/broadcast/${mockPodcast.id}`);
		const editProgram = page.getByRole("dialog", { name: "Modifier programme" });
		await page.getByRole("heading", { name: mockPodcast.name }).getByRole("button", { name: "Modifier" }).click();
		await editProgram.getByRole("combobox", { name: "Suivi" }).selectOption({ label: "Catalogue" });
		await editProgram.getByRole("button", { name: "Enregistrer" }).click();
		await expect(editProgram).not.toBeVisible();
		await page.getByRole("button", { name: "Importer le catalogue" }).click();
		await expect(page.locator(".import-result")).toHaveText("3 ajouté(s), 1 mis à jour");

		const rows = page.locator("table.catalog tbody tr:not(.season-row)");
		const seasonRows = page.locator("table.catalog tr.season-row");
		const stats = page.locator(".presentation .stats");
		const fourth = rows.filter({ hasText: "Podcast épisode 4" });
		await fourth.getByRole("button", { name: "Ignorer" }).click();
		// the ignored releases are hidden by default
		await expect(fourth).toHaveCount(0);
		await expect(seasonRows.nth(1)).toHaveText("Saison 2 (0/1)");
		await page.getByRole("checkbox", { name: "Cacher épisodes ignorés" }).uncheck();
		await expect(fourth).toHaveClass(/skipped/);
		await expect(fourth).toContainText("Ignoré");
		await expect(seasonRows.nth(1)).toHaveText("Saison 2 (0/1)");
		await expect(stats).toContainText("2 / 4 vus");
		await expect(stats).toContainText("(1 ignoré(s))");
		expect(await episodeOf("mock-pod-4")).toEqual({ status: "skipped" });

		const third = rows.filter({ hasText: "Podcast épisode 3" });
		await third.getByRole("button", { name: "À voir" }).click();
		await expect(third.getByRole("button", { name: "À voir" })).toHaveAttribute("aria-pressed", "true");
		await third.getByRole("button", { name: "Vu", exact: true }).click();
		await expect(third).toHaveClass(/watched/);
		await expect(third.getByRole("button", { name: "À voir" })).toHaveAttribute("aria-pressed", "false");
		await expect(stats).toContainText("3 / 4 vus");
		expect(await episodeOf("mock-pod-3")).toEqual({ status: null });

		// unignored
		await fourth.getByRole("button", { name: "Ignorer" }).click();
		await expect(stats).toContainText("3 / 5 vus");
	});
});
