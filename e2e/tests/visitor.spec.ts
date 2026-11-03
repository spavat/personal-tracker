import { expect, resetDb, SEED, test, updateMongo } from "../fixtures";

const API = "http://localhost:3001";
const { artists, spectacles, performances } = SEED.show;
const { mockPodcast, mockTube } = SEED.internet;
const { discovery, genres: musicGenres } = SEED.music;

test.describe("anonymous visitor", () => {
	test("only sees the public home page", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByText("Bienvenue sur Personal Tracker")).toBeVisible();
		await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Spectacle" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Musique" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Livre" })).toHaveCount(0);
		await expect(page.getByRole("link", { name: "Argent" })).toHaveCount(0);
	});

	test("is sent back home from a private page", async ({ page }) => {
		await page.goto("/sport/list");
		await expect(page).toHaveURL("/");
	});

	test("gets a 401 from private and write endpoints", async ({ request }) => {
		expect((await request.get(`${API}/context-tags/list`)).status()).toBe(401);
		expect((await request.delete(`${API}/context-tags/some-id`)).status()).toBe(401);
	});

	test("cannot log in with a wrong password", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill("owner@test.local");
		await page.getByLabel("Mot de passe").fill("wrong");
		await page.getByRole("button", { name: "Se connecter" }).click();
		await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
	});

	test.describe("shows (read only)", () => {
		test("lists without add, edit or delete buttons", async ({ page }) => {
			await page.goto("/shows/artists");
			await expect(page.getByRole("link", { name: artists.alice.name })).toBeVisible();
			await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
			await expect(page.getByRole("button", { name: "Ajouter un artiste" })).toHaveCount(0);
			await expect(page.getByTitle("Modifier")).toHaveCount(0);
		});

		test("details without edit buttons", async ({ page }) => {
			await page.goto(`/shows/spectacles/${spectacles.miserablesParis.id}`);
			await expect(page.getByRole("heading", { name: spectacles.miserablesParis.name })).toBeVisible();
			await expect(page.getByTitle("Ajouter une représentation")).toHaveCount(0);

			await page.goto(`/shows/performances/${performances.paris2025}`);
			await expect(page.getByRole("heading", { name: spectacles.miserablesParis.name })).toBeVisible();
			await expect(page.getByTitle("Modifier")).toHaveCount(0);
			await expect(page.getByRole("button", { name: "Editer le casting" })).toHaveCount(0);
		});

		for (const url of [
			"/shows/artists/add",
			`/shows/artists/edit/${artists.alice.id}`,
			`/shows/artists/${artists.alice.id}/edit`,
			`/shows/performances/${performances.paris2025}/casting`,
			"/shows/history/2026/add",
		]) {
			test(`is sent back home from ${url}`, async ({ page }) => {
				await page.goto(url);
				await expect(page).toHaveURL("/");
			});
		}

		test("reads the public endpoints but cannot write", async ({ request }) => {
			expect((await request.get(`${API}/show/artists/`)).status()).toBe(200);
			expect((await request.get(`${API}/show/performances/${performances.paris2025}`)).status()).toBe(200);
			expect((await request.get(`${API}/show/reports?from=2026-01-01&to=2026-12-31`)).status()).toBe(401);
			expect((await request.post(`${API}/show/artists/save`, { data: { name: "Intrus" } })).status()).toBe(401);
			expect((await request.delete(`${API}/show/artists/${artists.alice.id}`)).status()).toBe(401);
		});
	});

	test.describe("internet (read only)", () => {
		test("list without add or edit buttons, and no Sync Podcast", async ({ page }) => {
			await page.goto("/");
			await page.getByRole("link", { name: "Internet" }).click();
			await expect(page).toHaveURL(/\/internet\/history\/\d{4}-\d{2}$/);
			await expect(page.getByRole("link", { name: "Sync Podcast" })).toHaveCount(0);

			await page.goto("/internet/list");
			await expect(page.getByRole("link", { name: mockPodcast.name })).toBeVisible();
			await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
			await expect(page.getByRole("button", { name: "Ajouter un programme" })).toHaveCount(0);
			await expect(page.getByTitle("Modifier")).toHaveCount(0);
		});

		test("history and details without add, edit or delete buttons", async ({ page }) => {
			await page.goto("/internet/history/2026-10");
			await expect(page.getByRole("link", { name: mockPodcast.name, exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "Ajouter un programme" })).toHaveCount(0);

			await page.goto(`/internet/${mockPodcast.id}`);
			await expect(page.getByRole("heading", { name: mockPodcast.name })).toBeVisible();
			await expect(page.getByText("Podcast épisode 0")).toBeVisible();
			await expect(page.getByTitle("Modifier")).toHaveCount(0);
			await expect(page.getByTitle("Supprimer")).toHaveCount(0);
			await expect(page.getByTitle("Ajouter un épisode")).toHaveCount(0);
			await page.keyboard.press("Control+Shift+N");
			await expect(page.getByRole("dialog", { name: "Ajouter épisode" })).toHaveCount(0);
		});

		test("stats are public", async ({ page }) => {
			await page.goto("/internet/stats/2026");
			await expect(page).toHaveURL("/internet/stats/2026");
			await expect(page.getByRole("heading", { name: "Année 2026" })).toBeVisible();
		});

		for (const url of [
			"/internet/sync",
			"/internet/list/add",
			`/internet/list/edit/${mockPodcast.id}`,
			`/internet/${mockPodcast.id}/edit`,
			`/internet/${mockPodcast.id}/add`,
			"/internet/history/2026-10/add",
		]) {
			test(`is sent back home from ${url}`, async ({ page }) => {
				await page.goto(url);
				await expect(page).toHaveURL("/");
			});
		}

		test("reads the public endpoints but cannot write", async ({ request }) => {
			expect((await request.get(`${API}/internet/programs`)).status()).toBe(200);
			expect((await request.get(`${API}/internet/id/${mockPodcast.id}`)).status()).toBe(200);
			expect((await request.get(`${API}/internet/stats?from=2026-01-01&to=2026-12-31`)).status()).toBe(200);
			expect((await request.get(`${API}/internet/sync`)).status()).toBe(401);
			expect((await request.get(`${API}/internet/latest/${mockPodcast.id}`)).status()).toBe(401);
			expect((await request.get(`${API}/internet/extract?url=https://example.com`)).status()).toBe(401);
			expect(
				(await request.post(`${API}/internet/save`, { data: { program: { name: "Intrus" } } })).status(),
			).toBe(401);
			expect(
				(
					await request.delete(`${API}/internet/programs/${mockPodcast.id}/episodes/${mockPodcast.id}`)
				).status(),
			).toBe(401);
		});

		test.describe("private program", () => {
			test.beforeEach(() => updateMongo("internet", { id: mockTube.id }, { $set: { private: true } }));
			test.afterEach(resetDb);

			test("is hidden from the list, the history and the search", async ({ page, request }) => {
				await page.goto("/internet/list");
				await expect(page.getByRole("link", { name: mockPodcast.name })).toBeVisible();
				await expect(page.getByRole("link", { name: mockTube.name })).toHaveCount(0);

				await page.goto("/internet/history/2026-10");
				await expect(page.getByRole("link", { name: mockPodcast.name, exact: true })).toBeVisible();
				await expect(page.getByRole("link", { name: mockTube.name, exact: true })).toHaveCount(0);

				const search = await (await request.get(`${API}/internet/programs?search=tube`)).json();
				expect(search).toEqual([]);
			});

			test("is not found by id", async ({ request }) => {
				expect((await request.get(`${API}/internet/id/${mockTube.id}`)).status()).toBe(404);
			});

			test("is left out of the stats", async ({ request }) => {
				const stats = await (await request.get(`${API}/internet/stats?from=2026-01-01&to=2026-12-31`)).json();
				const names = stats.programs.map((p: { name: string }) => p.name);
				expect(names).toContain(mockPodcast.name);
				expect(names).not.toContain(mockTube.name);
			});
		});
	});

	test.describe("music (read only)", () => {
		test("history and list without add, edit or delete buttons", async ({ page }) => {
			await page.goto("/");
			await page.getByRole("link", { name: "Musique" }).click();
			await expect(page).toHaveURL(/\/music\/history\/\d{4}-\d{2}$/);

			await page.goto("/music/history/2026-10");
			await expect(page.locator(".card_item").filter({ hasText: discovery.album })).toBeVisible();
			await expect(page.getByRole("button", { name: "Ajouter une écoute" })).toHaveCount(0);

			await page.goto("/music/list/2026-10");
			await expect(page.getByText(`${discovery.artist} - ${discovery.album}`)).toBeVisible();
			await expect(page.getByRole("columnheader", { name: "Actions" })).toHaveCount(0);
			await expect(page.getByRole("button", { name: "Ajouter une écoute" })).toHaveCount(0);
			await expect(page.getByTitle("Modifier")).toHaveCount(0);
			await expect(page.getByTitle("Supprimer")).toHaveCount(0);
			await page.keyboard.press("Control+Shift+N");
			await expect(page.getByRole("dialog", { name: "Ajouter une écoute" })).toHaveCount(0);
		});

		test("has no Genres submenu", async ({ page }) => {
			await page.goto("/music/history/2026-10");
			await expect(page.getByRole("link", { name: "Liste" })).toBeVisible();
			await expect(page.getByRole("link", { name: "Genres" })).toHaveCount(0);
		});

		test("stats are public", async ({ page }) => {
			await page.goto("/music/stats/2026");
			await expect(page).toHaveURL("/music/stats/2026");
			await expect(page.getByText("Albums / EPs")).toBeVisible();
		});

		for (const url of [
			"/music/history/2026-10/add",
			"/music/list/2026-10/add",
			`/music/list/2026-10/${discovery.id}/edit`,
			`/music/list/2026-10/${discovery.id}/delete`,
			"/music/stats/2026/add",
			"/music/genres",
			"/music/genres/add",
			`/music/genres/edit/${musicGenres.rock.id}`,
			`/music/genres/delete/${musicGenres.rock.id}`,
		]) {
			test(`is sent back home from ${url}`, async ({ page }) => {
				await page.goto(url);
				await expect(page).toHaveURL("/");
			});
		}

		test("reads the public endpoints but cannot write", async ({ request }) => {
			expect((await request.get(`${API}/music/list?from=2026-10-01&to=2026-10-31`)).status()).toBe(200);
			expect((await request.get(`${API}/music/search?search=radio`)).status()).toBe(200);
			expect((await request.get(`${API}/music/id?id=${discovery.id}`)).status()).toBe(200);
			expect((await request.get(`${API}/music/genres`)).status()).toBe(401);
			expect((await request.get(`${API}/music/stats?from=2026-01-01&to=2026-12-31`)).status()).toBe(200);
			expect((await request.get(`${API}/music/fortnight-stats`)).status()).toBe(200);
			expect((await request.get(`${API}/music/reports?from=2026-01-01&to=2026-12-31`)).status()).toBe(401);
			expect((await request.post(`${API}/music/save`, { data: { album: "Intrus" } })).status()).toBe(401);
			expect((await request.delete(`${API}/music/${discovery.id}`)).status()).toBe(401);
			expect((await request.post(`${API}/music/genres/save`, { data: { name: "Intrus" } })).status()).toBe(401);
			expect((await request.delete(`${API}/music/genres/${musicGenres.rock.id}`)).status()).toBe(401);
		});
	});
});
