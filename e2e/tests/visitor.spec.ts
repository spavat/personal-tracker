import { expect, SEED, test } from "../fixtures";

const API = "http://localhost:3001";
const { artists, spectacles, performances } = SEED.show;

test.describe("anonymous visitor", () => {
	test("only sees the public home page", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByText("Bienvenue sur Personal Tracker")).toBeVisible();
		await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Spectacle" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Musique" })).toHaveCount(0);
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
});
