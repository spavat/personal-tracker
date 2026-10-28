import { expect, SEED, test } from "../../fixtures";

const { onePiece } = SEED.manga;
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/reading-manga/list/${UNKNOWN}/edit?returnTo=/reading-manga/list`, "Manga introuvable"],
	[
		`/reading-manga/manga/${onePiece.id}/reading/${UNKNOWN}/edit?returnTo=/reading-manga/manga/${onePiece.id}`,
		"Lecture introuvable",
	],
	[
		`/reading-manga/manga/${onePiece.id}/reading/${UNKNOWN}/delete?returnTo=/reading-manga/manga/${onePiece.id}`,
		"Lecture introuvable",
	],
];

test.describe("reading-manga - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
