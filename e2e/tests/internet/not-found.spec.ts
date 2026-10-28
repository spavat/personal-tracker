import { expect, SEED, test } from "../../fixtures";

const { mockPodcast } = SEED.internet;
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/internet/list/edit/${UNKNOWN}?returnTo=/internet/list`, "Programme introuvable"],
	[`/internet/${mockPodcast.id}/episode/${UNKNOWN}/edit?returnTo=/internet/${mockPodcast.id}`, "Épisode introuvable"],
	[
		`/internet/${mockPodcast.id}/episode/${UNKNOWN}/delete?returnTo=/internet/${mockPodcast.id}`,
		"Épisode introuvable",
	],
];

test.describe("internet - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
