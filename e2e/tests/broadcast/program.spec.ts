import type { Page } from "@playwright/test";

import { expect, pickEntity, queryDb, resetDb, SEED, test } from "../../fixtures";

const { mockPodcast, mockTube } = SEED.broadcast;
// "Podcast épisode 1" of Mock Podcast (its view has the same id)
const PODCAST_EPISODE_1 = "85bd54c7-6d92-464a-9523-c7c67016b8b5";
const countEpisode = async (id: string) =>
	(await queryDb("SELECT count(*)::int AS n FROM broadcast.episode WHERE id = $1", [id]))[0].n;

function episodeRows(page: Page) {
	// one row per view: its actions are on it
	return page.locator("table.episodes tbody tr").filter({ has: page.getByRole("button", { name: "Modifier" }) });
}

function episodeRow(page: Page, name: string) {
	return episodeRows(page).filter({ hasText: name });
}

// The read-only details of an episode, opened from its title
async function openDetails(page: Page, title: string) {
	await page.getByRole("button", { name: title, exact: true }).first().click();
	const dialog = page.getByRole("dialog", { name: "Détails de l'épisode" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function openProgram(page: Page, program: { id: string; name: string }) {
	await page.goto(`/broadcast/${program.id}`);
	await expect(page.getByRole("heading", { name: program.name })).toBeVisible();
}

test.describe("Broadcast - Program details", () => {
	test.afterEach(resetDb);

	test("the program's credits lead to their directory page", async ({ page }) => {
		await openProgram(page, mockPodcast);
		const general = page.locator(".presentation .general");
		await general.getByRole("link", { name: "Mock Radio" }).click();
		await expect(page.getByRole("heading", { name: "Mock Radio" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Émissions diffusées" })).toBeVisible();

		await openProgram(page, mockPodcast);
		await general.getByRole("link", { name: "Pod Caster" }).click();
		await expect(page.getByRole("heading", { name: "Émissions animées" })).toBeVisible();
	});

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
		await expect(first.nth(2)).toContainText("24/10/26");
		await expect(first.nth(4)).toContainText("metro");
		await expect(first.nth(5)).toHaveText("30min*");
	});

	test("the title opens the episode's details, read only", async ({ page }) => {
		await openProgram(page, mockTube);
		const row = episodeRow(page, "Mock video 1");
		await expect(row.locator(".fa-circle-info")).toBeVisible();
		await expect(row).toContainText("tuto");
		// no link on the title
		await expect(row.getByRole("link")).toHaveCount(0);

		const details = await openDetails(page, "Mock video 1");
		await expect(details.getByRole("heading", { name: "Mock video 1" })).toBeVisible();
		await expect(details.getByRole("link", { name: "youtube.com" })).toHaveAttribute(
			"href",
			"https://www.youtube.com/watch?v=vid00000001",
		);
		await expect(details).toContainText("Programme : Mock Tube");
		await expect(details).toContainText("vid00000001");
		await expect(details).toContainText("tuto");
		await expect(details).toContainText("1 vue(s)");
		await expect(details.locator("table.episode-views tbody tr")).toHaveText([/20\/10\/26.*Très bien/]);
		await expect(details.getByRole("textbox")).toHaveCount(0);
		await details.getByRole("button", { name: "Fermer" }).click();
		await expect(details).not.toBeVisible();
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
		await expect(row.locator("td").nth(4)).toContainText("intro");
		await expect(row.locator("td").nth(4)).toContainText("velo");
		await expect(row.locator(".fa-circle-info")).toBeVisible();
		await expect(row.locator("td").nth(5)).toHaveText("25min*");
	});

	test("an episode's description and cover typed in its form, then the cover removed", async ({ page }) => {
		await openProgram(page, mockPodcast);
		const row = episodeRow(page, "Podcast épisode 0");
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await row.getByRole("button", { name: "Modifier" }).click();
		await dialog.getByRole("textbox", { name: "Description" }).fill("Première ligne\nDeuxième ligne");
		await dialog.getByRole("textbox", { name: "Couverture" }).fill("https://images.example.com/episode-cover.svg");
		await expect(dialog.getByRole("img", { name: "Couverture" })).toBeVisible();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await expect(row.locator(".episode-cover img")).toHaveAttribute("src", /\/images\/broadcast\/episode\//);
		// the description is in the details only
		await expect(row).not.toContainText("Première ligne");
		const details = await openDetails(page, "Podcast épisode 0");
		await expect(details.locator(".dialog-body > .description")).toHaveText("Première ligne\nDeuxième ligne");
		await details.getByRole("button", { name: "Fermer" }).click();

		// sent back unchanged: the stored cover is kept
		const src = await row.locator(".episode-cover img").getAttribute("src");
		await row.getByRole("button", { name: "Modifier" }).click();
		await expect(dialog.getByRole("textbox", { name: "Couverture" })).toHaveValue(
			/^\/images\/broadcast\/episode\//,
		);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(row.locator(".episode-cover img")).toHaveAttribute("src", src!);

		await row.getByRole("button", { name: "Modifier" }).click();
		await dialog.getByRole("textbox", { name: "Couverture" }).clear();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(row.locator(".episode-cover img")).toHaveCount(0);
		const [{ cover_key }] = await queryDb("SELECT cover_key FROM broadcast.episode WHERE name = $1", [
			"Podcast épisode 0",
		]);
		expect(cover_key).toBeNull();
	});

	test("clear the real duration and the context tags of an episode", async ({ page }) => {
		await openProgram(page, mockPodcast);
		const row = episodeRow(page, "Podcast épisode 1");
		await expect(row.locator("td").nth(4)).toContainText("metro");
		await expect(row.locator("td").nth(5)).toHaveText("30min*");

		await row.getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await dialog.getByRole("spinbutton", { name: "Durée réelle" }).clear();
		await dialog.locator(".badge-edit span", { hasText: "✕" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(row.locator("td").nth(4)).not.toContainText("metro");
		await expect(row.locator("td").nth(5)).toHaveText("45min");
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

	test("an episode listened twice has a line per view, sharing the episode's fields", async ({ page }) => {
		await queryDb(
			"INSERT INTO broadcast.view (episode_id, date, created_at) VALUES ($1, '2026-10-26', '2026-10-26T08:00:00')",
			[PODCAST_EPISODE_1],
		);
		await openProgram(page, mockPodcast);
		await expect(episodeRows(page)).toHaveCount(3);
		await expect(episodeRow(page, "Podcast épisode 1")).toHaveCount(2);

		// the episode's fields change on both lines
		await episodeRow(page, "Podcast épisode 1").first().getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await expect(dialog).toContainText("Épisode écouté 2 fois");
		await dialog.getByRole("textbox", { name: "Titre *", exact: true }).fill("Podcast épisode un");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(episodeRow(page, "Podcast épisode un")).toHaveCount(2);

		// deleting a line deletes its view: the episode stays while it has another one, then goes with its last
		const deletion = page.getByRole("dialog", { name: "Supprimer épisode" });
		await episodeRow(page, "Podcast épisode un").first().getByRole("button", { name: "Supprimer" }).click();
		await deletion.getByRole("button", { name: "Supprimer" }).click();
		await expect(deletion).not.toBeVisible();
		await expect(episodeRow(page, "Podcast épisode un")).toHaveCount(1);
		expect(await countEpisode(PODCAST_EPISODE_1)).toBe(1);

		await episodeRow(page, "Podcast épisode un").getByRole("button", { name: "Supprimer" }).click();
		await deletion.getByRole("button", { name: "Supprimer" }).click();
		await expect(episodeRows(page)).toHaveCount(1);
		expect(await countEpisode(PODCAST_EPISODE_1)).toBe(0);
	});

	test("credit a guest on an episode, shown in its details", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await episodeRow(page, "Podcast épisode 0").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await dialog.getByRole("button", { name: "Ajouter un crédit" }).click();
		await expect(dialog.getByRole("combobox", { name: "Invité·es, animation 1 : rôle" })).toHaveValue("guest");
		await pickEntity(dialog, "Invité·es, animation 1", "Jane Guest");
		await dialog.getByRole("textbox", { name: "Invité·es, animation 1 crédité·e comme" }).fill("JG");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const details = await openDetails(page, "Podcast épisode 0");
		await expect(details).toContainText("Invité·e : JG");
		// the participant leads to its directory page
		await details.getByRole("link", { name: "JG" }).click();
		await expect(page).toHaveURL(/\/entities\/[0-9a-f-]{36}$/);
		await expect(page.getByRole("heading", { name: "Jane Guest" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();
	});

	test("fix an entity from its credit: renamed, and moved to another kind", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await page.getByRole("heading", { name: mockPodcast.name }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier programme" });
		await expect(dialog.getByRole("textbox", { name: "Crédits 1", exact: true })).toHaveValue("Pod Caster");

		await dialog.getByRole("button", { name: "Modifier l'entité" }).first().click();
		await dialog.getByRole("textbox", { name: "Nom de l'entité" }).fill("Pod Casters");
		await dialog.getByRole("combobox", { name: "Type d'entité" }).selectOption("group");
		await dialog.getByRole("button", { name: "Enregistrer" }).first().click();
		// the row follows the entity to its new kind
		await expect(dialog.getByRole("combobox", { name: "Crédits 1 : type" })).toHaveValue("group");
		await expect(dialog.getByRole("textbox", { name: "Crédits 1", exact: true })).toHaveValue("Pod Casters");
		await dialog.getByRole("button", { name: "Enregistrer" }).last().click();
		await expect(dialog).not.toBeVisible();

		await expect(page.locator(".presentation .general")).toContainText("par : Pod Casters");
		expect(await queryDb("SELECT kind FROM core.entity WHERE name = 'Pod Casters'")).toEqual([{ kind: "group" }]);
		// its subtype row moved too
		expect(
			await queryDb(
				"SELECT count(*)::int AS n FROM core.entity_group g JOIN core.entity e USING (id) WHERE e.name = 'Pod Casters'",
			),
		).toEqual([{ n: 1 }]);
	});

	test("seasons and formats: the lines grouped by season, filtered by format", async ({ page }) => {
		await openProgram(page, mockPodcast);

		await page.getByRole("button", { name: "Saisons" }).click();
		const seasons = page.getByRole("dialog", { name: "Saisons" });
		for (const [index, label] of ["Saison 1", "Saison 2"].entries()) {
			await seasons.getByRole("button", { name: "Ajouter une saison" }).click();
			await seasons.getByRole("textbox", { name: `Nom ${index + 1}` }).fill(label);
		}
		await seasons.getByRole("button", { name: "Enregistrer" }).click();
		await expect(seasons).not.toBeVisible();

		await page.getByRole("button", { name: "Formats" }).click();
		const formats = page.getByRole("dialog", { name: "Formats" });
		await formats.getByRole("button", { name: "Ajouter un format" }).click();
		await formats.getByRole("textbox", { name: "Nom 1" }).fill("Suite");
		await formats.getByRole("textbox", { name: "Règle 1" }).fill("épisode [1-9]");
		await formats.getByRole("button", { name: "Enregistrer" }).click();
		await expect(formats).not.toBeVisible();

		await episodeRow(page, "Podcast épisode 1").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier épisode" });
		await dialog.getByRole("combobox", { name: "Saison" }).selectOption({ label: "Saison 2" });
		await dialog.getByRole("combobox", { name: "Format" }).selectOption({ label: "Suite" });
		await dialog.getByRole("textbox", { name: "Numéro" }).fill("1");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		// the latest season first, the lines without season last
		await expect(page.locator("tr.season-row")).toHaveText(["Saison 2 (1)", "Sans saison (1)"]);
		await expect(episodeRow(page, "Podcast épisode 1")).toContainText("1 · Podcast épisode 1");

		await page.getByRole("combobox", { name: "Format" }).selectOption({ label: "Suite" });
		await expect(episodeRows(page)).toHaveCount(1);
		await expect(page.locator("tr.season-row")).toHaveText(["Saison 2 (1)"]);
	});

	test("a format's match rule pre-selects it for a new episode", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await page.getByRole("button", { name: "Formats" }).click();
		const formats = page.getByRole("dialog", { name: "Formats" });
		await formats.getByRole("button", { name: "Ajouter un format" }).click();
		await formats.getByRole("textbox", { name: "Nom 1" }).fill("Troisième");
		await formats.getByRole("textbox", { name: "Règle 1" }).fill("ÉPISODE 3$");
		await formats.getByRole("button", { name: "Enregistrer" }).click();
		await expect(formats).not.toBeVisible();

		await page.getByRole("button", { name: "Ajouter un épisode" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter épisode" });
		await dialog.locator(".latest li").getByText("Podcast épisode 3").click();
		await expect(dialog.getByRole("combobox", { name: "Format" })).toHaveValue(
			(await queryDb("SELECT id FROM broadcast.format WHERE label = 'Troisième'"))[0].id,
		);
	});

	test("a feed completed from its RSS feed: only its stored episodes, nothing added", async ({ page }) => {
		await openProgram(page, mockPodcast);
		// "Podcast épisode 1" is the stored episode of the feed (guid mock-pod-1), "Podcast épisode 0" has no guid
		await page.getByRole("button", { name: "Compléter les épisodes (RSS)" }).click();
		await expect(page.locator(".import-result")).toHaveText("1 mis à jour");
		await expect(episodeRows(page)).toHaveCount(2);
		await expect(page.locator("table.catalog")).toHaveCount(0);

		const [program] = await queryDb("SELECT tracking FROM broadcast.program WHERE id = $1", [mockPodcast.id]);
		expect(program.tracking).toBe("feed");
		const episodes = await queryDb(
			`SELECT e.name, e.release_date::text AS release_date, s.label AS season
			FROM broadcast.episode e LEFT JOIN broadcast.season s ON s.id = e.season_id
			WHERE e.program_id = $1 ORDER BY e.name`,
			[mockPodcast.id],
		);
		expect(episodes).toEqual([
			{ name: "Podcast épisode 0", release_date: null, season: null },
			{ name: "Podcast épisode 1", release_date: "2026-10-17", season: "Saison 1" },
		]);
		// only the season of its episodes
		const seasons = await queryDb("SELECT label FROM broadcast.season WHERE program_id = $1", [mockPodcast.id]);
		expect(seasons).toEqual([{ label: "Saison 1" }]);
	});

	test("a feed completed from YouTube: its videos asked by their link, nothing added", async ({ page }) => {
		// "Mock video 1" added by hand without its id, "Vidéo de septembre" with a short link to vid00000002
		await queryDb("UPDATE broadcast.episode SET external_id = NULL WHERE name = 'Mock video 1'");
		await queryDb("UPDATE broadcast.episode SET link = 'https://youtu.be/vid00000002' WHERE name = $1", [
			"Vidéo de septembre",
		]);
		await openProgram(page, mockTube);
		await page.getByRole("button", { name: "Compléter les épisodes (chaîne YouTube)" }).click();
		await expect(page.locator(".import-result")).toHaveText("2 mis à jour");
		await expect(episodeRows(page)).toHaveCount(2);

		const episodes = await queryDb(
			`SELECT name, external_id, release_date::text AS release_date, duration FROM broadcast.episode
			WHERE program_id = $1 ORDER BY name`,
			[mockTube.id],
		);
		expect(episodes).toEqual([
			{ name: "Mock video 1", external_id: "vid00000001", release_date: "2026-10-21", duration: 15 },
			{ name: "Mock video 2", external_id: "vid00000002", release_date: "2026-10-22", duration: 8 },
		]);
	});

	test("a catalog: its feed imported, one line per release by season, « Vu » adding a view", async ({ page }) => {
		await openProgram(page, mockPodcast);
		const editProgram = page.getByRole("dialog", { name: "Modifier programme" });
		await page.getByRole("heading", { name: mockPodcast.name }).getByRole("button", { name: "Modifier" }).click();
		await editProgram.getByRole("combobox", { name: "Suivi" }).selectOption({ label: "Catalogue" });
		await editProgram.getByRole("button", { name: "Enregistrer" }).click();
		await expect(editProgram).not.toBeVisible();

		// the feed has 4 items in 2 itunes seasons: "Podcast épisode 1" was stored, it gets its release date
		await page.getByRole("button", { name: "Importer le catalogue" }).click();
		await expect(page.locator(".import-result")).toHaveText("3 ajouté(s), 1 mis à jour");
		const seasonRows = page.locator("table.catalog tr.season-row");
		const rows = page.locator("table.catalog tbody tr:not(.season-row)");
		await expect(seasonRows).toHaveText(["Saison 1 (1/2)", "Saison 2 (0/2)", "Sans saison (1/1)"]);
		// oldest release first
		await expect(rows.locator("td:nth-child(2) .episode-name")).toHaveText([
			"Podcast épisode 1",
			"Podcast épisode 2",
			"Podcast épisode 3",
			"Podcast épisode 4",
			"Podcast épisode 0",
		]);
		await expect(rows.first()).toContainText("17/10/26");
		// the item's description as text, its own image stored and served by the API
		const coverOf = async (name: string) =>
			(
				await queryDb("SELECT cover_key FROM broadcast.episode WHERE program_id = $1 AND name = $2", [
					mockPodcast.id,
					name,
				])
			)[0].cover_key;
		const thirdCover = rows.filter({ hasText: "Podcast épisode 3" }).locator(".episode-cover img");
		await expect(thirdCover).toHaveAttribute("src", /\/images\/broadcast\/episode\/[0-9a-f-]+\?v=[0-9a-f]+$/);
		expect((await page.request.get((await thirdCover.getAttribute("src"))!)).status()).toBe(200);
		// the watched release has its check, the others none
		await expect(rows.first()).toHaveClass(/watched/);
		await expect(rows.filter({ hasText: "Podcast épisode 3" }).locator(".cover-check")).toHaveCount(0);
		const details = await openDetails(page, "Podcast épisode 3");
		await expect(details.locator(".dialog-body > .description")).toContainText("Le troisième épisode");
		await expect(details.locator(".dialog-body > .description")).toContainText("Avec un invité");
		await expect(details).toContainText("Saison : Saison 2");
		await expect(details).toContainText("0 vue(s)");
		await details.getByRole("button", { name: "Fermer" }).click();
		// the channel's image is the program's
		await expect(rows.filter({ hasText: "Podcast épisode 4" }).locator(".episode-cover img")).toHaveCount(0);
		// shown as a feed: one line per view, back to the releases
		const viewSwitch = page.getByRole("button", { name: "Change d'affichage" });
		await viewSwitch.click();
		await expect(page.locator("table.catalog")).toHaveCount(0);
		await expect(episodeRows(page)).toHaveCount(2);
		// grouped by season, or flat
		await expect(page.locator("table.episodes tr.season-row")).toHaveText(["Saison 1 (1)", "Sans saison (1)"]);
		await page.getByRole("checkbox", { name: "Grouper par saisons" }).uncheck();
		await expect(page.locator("table.episodes tr.season-row")).toHaveCount(0);
		await expect(episodeRows(page)).toHaveCount(2);
		await viewSwitch.click();
		await expect(rows).toHaveCount(5);
		// imported again: nothing changes, the stored cover is kept
		const storedCover = await coverOf("Podcast épisode 3");
		await page.getByRole("button", { name: "Importer le catalogue" }).click();
		await expect(page.locator(".import-result")).toHaveText("0 ajouté(s), 0 mis à jour");
		expect(await coverOf("Podcast épisode 3")).toBe(storedCover);
		await expect(rows.nth(2).locator("td").first()).toHaveText("1");
		const stats = page.locator(".presentation .stats");
		await expect(stats).toContainText("2 / 5 vus");

		const third = rows.filter({ hasText: "Podcast épisode 3" });
		await third.getByRole("button", { name: "Vu", exact: true }).click();
		await expect(seasonRows.nth(1)).toHaveText("Saison 2 (1/2)");
		await expect(third.locator(".cover-check")).toBeVisible();
		await expect(stats).toContainText("3 / 5 vus");

		// a catalog keeps the episode of its deleted view
		await third.getByRole("button", { name: "Supprimer la dernière vue" }).click();
		const deletion = page.getByRole("dialog", { name: "Supprimer épisode" });
		await deletion.getByRole("button", { name: "Supprimer" }).click();
		await expect(seasonRows.nth(1)).toHaveText("Saison 2 (0/2)");
		await expect(rows).toHaveCount(5);

		// back to a feed: the episodes never viewed go
		await page.getByRole("heading", { name: mockPodcast.name }).getByRole("button", { name: "Modifier" }).click();
		await editProgram.getByRole("combobox", { name: "Suivi" }).selectOption({ label: "Flux" });
		await expect(editProgram).toContainText("Les épisodes jamais vus seront supprimés");
		await editProgram.getByRole("button", { name: "Enregistrer" }).click();
		await expect(editProgram).not.toBeVisible();
		await expect(episodeRows(page)).toHaveCount(2);
		const [{ n }] = await queryDb("SELECT count(*)::int AS n FROM broadcast.episode WHERE program_id = $1", [
			mockPodcast.id,
		]);
		expect(n).toBe(2);
	});

	test("a YouTube catalog: the channel's videos imported, without the deleted and upcoming ones", async ({
		page,
	}) => {
		await openProgram(page, mockTube);
		const editProgram = page.getByRole("dialog", { name: "Modifier programme" });
		await page.getByRole("heading", { name: mockTube.name }).getByRole("button", { name: "Modifier" }).click();
		await editProgram.getByRole("combobox", { name: "Suivi" }).selectOption({ label: "Catalogue" });
		await editProgram.getByRole("button", { name: "Enregistrer" }).click();
		await expect(editProgram).not.toBeVisible();

		// "Mock video 1" was stored: it gets its release date, description and cover
		await page.getByRole("button", { name: "Importer le catalogue (chaîne YouTube)" }).click();
		await expect(page.locator(".import-result")).toHaveText("2 ajouté(s), 1 mis à jour");
		const rows = page.locator("table.catalog tbody tr:not(.season-row)");
		await expect(rows.locator("td:nth-child(2) .episode-name")).toHaveText([
			"Mock video 1",
			"Mock video 2",
			"Mock video 3",
			"Vidéo de septembre",
		]);
		const third = rows.filter({ hasText: "Mock video 3" });
		await expect(third).toContainText("23/10/26");
		await expect(third).toContainText("10min");
		await expect(third.locator(".episode-cover img")).toHaveAttribute("src", /\/images\/broadcast\/episode\//);
		const details = await openDetails(page, "Mock video 3");
		await expect(details.locator(".dialog-body > .description")).toContainText("La troisième vidéo");
		const [{ type }] = await queryDb("SELECT type FROM broadcast.episode WHERE external_id = $1", ["vid00000003"]);
		expect(type).toBe("video");
	});

	test("search a program with ctrl+shift+f", async ({ page }) => {
		await openProgram(page, mockPodcast);
		await page.keyboard.press("Control+Shift+F");
		const search = page.getByPlaceholder("Recherche");
		await expect(search).toBeFocused();
		await search.fill("tube");
		await expect(page.locator(".search .result-item")).toHaveCount(1);
		await page.keyboard.press("Enter");

		await expect(page).toHaveURL(`/broadcast/${mockTube.id}`);
		await expect(page.getByRole("heading", { name: mockTube.name })).toBeVisible();
	});

	test("ctrl+shift+n opens the add episode modal", async ({ page }) => {
		await openProgram(page, mockTube);
		await page.keyboard.press("Control+Shift+N");
		await expect(page.getByRole("dialog", { name: "Ajouter épisode" })).toBeVisible();
	});
});
