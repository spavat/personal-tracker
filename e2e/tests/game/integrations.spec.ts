import { expect, test } from "../../fixtures";

// The e2e server has no store account (see playwright.config.ts) and no daily scheduler.
test.describe("Game - Integrations", () => {
	test("shows each store as not configured, with how to set it up", async ({ page }) => {
		await page.goto("/game/history");
		await page.locator(".menu").getByRole("link", { name: "Intégrations" }).click();
		await expect(page).toHaveURL(/\/game\/integrations$/);

		const panels = page.locator(".panel.integration");
		await expect(panels.locator("h3")).toHaveText([
			"Steam Non configuré",
			"GOG Non configuré",
			"Epic Games Non configuré",
		]);
		await expect(panels.nth(0)).toContainText("STEAM_API_KEY");
		await expect(panels.nth(2)).toContainText("seed-epic-token.ts");
		await expect(panels.nth(0)).toContainText("Dernière récupération : jamais");
		await expect(page.getByRole("button", { name: "Lancer maintenant" })).toHaveCount(3);
		for (const button of await page.getByRole("button", { name: "Lancer maintenant" }).all()) {
			await expect(button).toBeDisabled();
		}
		await expect(page.getByText("Doublons possibles")).toHaveCount(0);
		// no failed fetch: no marker on the nav link
		await expect(page.locator(".menu .sync-error")).toHaveCount(0);
	});
});
