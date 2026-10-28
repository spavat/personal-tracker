import { expect, test } from "../../fixtures";

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/music/genres/edit/${UNKNOWN}?returnTo=/music/genres`, "Genre introuvable"],
	[`/music/genres/delete/${UNKNOWN}?returnTo=/music/genres`, "Genre introuvable"],
	[`/music/list/2026-10/${UNKNOWN}/edit?returnTo=/music/list/2026-10`, "Écoute introuvable"],
	[`/music/list/2026-10/${UNKNOWN}/delete?returnTo=/music/list/2026-10`, "Écoute introuvable"],
];

test.describe("music - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
