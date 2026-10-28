import { expect, test } from "../fixtures";

test.describe("anonymous visitor", () => {
	test("only sees the public home page", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByText("Bienvenue sur Personal Tracker")).toBeVisible();
		await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Musique" })).toHaveCount(0);
		await expect(page.getByRole("link", { name: "Argent" })).toHaveCount(0);
	});

	test("is sent back home from a private page", async ({ page }) => {
		await page.goto("/sport/list");
		await expect(page).toHaveURL("/");
	});

	test("gets a 401 from private and write endpoints", async ({ request }) => {
		const api = "http://localhost:3001";
		expect((await request.get(`${api}/context-tags/list`)).status()).toBe(401);
		expect((await request.delete(`${api}/context-tags/some-id`)).status()).toBe(401);
	});

	test("cannot log in with a wrong password", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill("owner@test.local");
		await page.getByLabel("Mot de passe").fill("wrong");
		await page.getByRole("button", { name: "Se connecter" }).click();
		await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
	});
});
