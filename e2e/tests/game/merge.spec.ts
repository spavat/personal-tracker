import { expect, resetDb, SEED, test } from "../../fixtures";

const { hollow, ruins } = SEED.game;

test.describe("Game - Merge", () => {
	test.afterEach(resetDb);

	test("merges the secondary game's plays into the main one and deletes it", async ({ page }) => {
		await page.goto("/game/history");
		await page.locator(".menu").getByRole("link", { name: "Fusionner" }).click();
		await expect(page).toHaveURL(/\/game\/merge$/);

		await page.getByLabel("Filtrer : Jeu principal").fill("hollow");
		await page
			.getByRole("combobox", { name: "Jeu principal" })
			.selectOption({ label: `${hollow.name} (3 parties)` });
		await page
			.getByRole("combobox", { name: "Jeu secondaire" })
			.selectOption({ label: `${ruins.name} (1 partie)` });

		const result = page.locator(".merge .panel").filter({ hasText: "Résultat" });
		await expect(result).toContainText(`Il reçoit les 1 partie de ${ruins.name} (1h)`);
		await expect(result).toContainText(`${ruins.name} est supprimé`);

		// swapped then swapped back: the main one is the first picked
		await page.getByRole("button", { name: "Inverser" }).click();
		await expect(page.getByRole("combobox", { name: "Jeu principal" })).toHaveValue(ruins.id);
		await page.getByRole("button", { name: "Inverser" }).click();

		await page.getByRole("button", { name: "Fusionner" }).click();

		await expect(page).toHaveURL(new RegExp(`/game/details/${hollow.id}$`));
		await expect(page.locator("table.plays tbody tr")).toHaveCount(4);

		await page.goto("/game/list");
		await expect(page.locator("table.games tbody tr").filter({ hasText: ruins.name })).toHaveCount(0);
	});
});
