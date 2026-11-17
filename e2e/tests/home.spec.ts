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
});
