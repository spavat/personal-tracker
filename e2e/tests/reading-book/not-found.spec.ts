import { expect, SEED, test } from "../../fixtures";

const { alice } = SEED.book;
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[
		`/reading-book/book/${alice.id}/reading/${UNKNOWN}/delete?returnTo=/reading-book/book/${alice.id}`,
		"Lecture introuvable",
	],
];

test.describe("reading-book - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
