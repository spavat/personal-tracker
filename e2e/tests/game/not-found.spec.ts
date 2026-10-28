import { expect, SEED, test } from "../../fixtures";

const { starFarm } = SEED.game;
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/game/list/${UNKNOWN}/edit?returnTo=/game/list`, "Jeu introuvable"],
	[`/game/details/${starFarm.id}/play/${UNKNOWN}/edit?returnTo=/game/details/${starFarm.id}`, "Partie introuvable"],
	[`/game/details/${starFarm.id}/play/${UNKNOWN}/delete?returnTo=/game/details/${starFarm.id}`, "Partie introuvable"],
];

test.describe("game - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
