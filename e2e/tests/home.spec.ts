import { expect, test } from "../fixtures";

test.describe("Home", () => {
	test("the owner sees the public home page, and the dashboard in a tab", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByText("Bienvenue sur Personal Tracker")).toBeVisible();

		await page.locator(".menu").getByRole("link", { name: "Dashboard" }).click();
		await expect(page).toHaveURL("/dashboard");
		await expect(page.getByRole("heading", { name: "Musique" })).toBeVisible();

		await page.locator(".menu").getByRole("link", { name: "Accueil" }).click();
		await expect(page).toHaveURL("/");
		await expect(page.getByText("Bienvenue sur Personal Tracker")).toBeVisible();
	});

	test("the home page groups the 6 latest episodes by program, the latest program first", async ({ page }) => {
		await page.goto("/");

		const cards = page.locator("section.broadcast .card_item");
		await expect(cards.locator(".title")).toHaveText([
			/Mock Podcast/,
			/Mock Tube/,
			/Tour de France/,
			/The Great Show/,
		]);
		// each card lists its episodes oldest first; The Great Show's first episode is older than the 6 latest
		await expect(cards.nth(0).locator("b")).toHaveText(["Podcast épisode 0", "Podcast épisode 1"]);
		await expect(cards.nth(3).locator("b")).toHaveText(["Episode 2"]);
	});
});
