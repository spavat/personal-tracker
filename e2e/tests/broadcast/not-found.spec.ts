import { expect, SEED, test } from "../../fixtures";

const { mockPodcast } = SEED.broadcast;
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/broadcast/list/edit/${UNKNOWN}?returnTo=/broadcast/list`, "Programme introuvable"],
	[
		`/broadcast/${mockPodcast.id}/episode/${UNKNOWN}/edit?returnTo=/broadcast/${mockPodcast.id}`,
		"Épisode introuvable",
	],
	[
		`/broadcast/${mockPodcast.id}/episode/${UNKNOWN}/delete?returnTo=/broadcast/${mockPodcast.id}`,
		"Épisode introuvable",
	],
];

test.describe("broadcast - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
