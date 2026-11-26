import { expect, SEED, test } from "../../fixtures";

const { hamlet } = SEED.show.spectacles;
// a well-formed id that matches nothing (a malformed one is refused with a 400 before the lookup)
const UNKNOWN = "00000000-0000-4000-8000-000000000999";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/shows/places/edit/${UNKNOWN}?returnTo=/shows/places`, "Salle introuvable"],
	[`/shows/places/delete/${UNKNOWN}?returnTo=/shows/places`, "Salle introuvable"],
	[`/shows/works/edit/${UNKNOWN}?returnTo=/shows/works`, "Œuvre introuvable"],
	[
		`/shows/spectacles/${hamlet.id}/editModel/${UNKNOWN}?returnTo=/shows/spectacles/${hamlet.id}`,
		"Modèle introuvable",
	],
	[
		`/shows/spectacles/${hamlet.id}/deleteModel/${UNKNOWN}?returnTo=/shows/spectacles/${hamlet.id}`,
		"Modèle introuvable",
	],
];

test.describe("show - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
