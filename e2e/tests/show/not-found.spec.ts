import { expect, SEED, test } from "../../fixtures";

const { hamlet } = SEED.show.spectacles;

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	["/shows/artists/edit/999?returnTo=/shows/artists", "Artiste introuvable"],
	["/shows/artists/delete/999?returnTo=/shows/artists", "Artiste introuvable"],
	["/shows/places/edit/999?returnTo=/shows/places", "Salle introuvable"],
	["/shows/places/delete/999?returnTo=/shows/places", "Salle introuvable"],
	["/shows/works/edit/999?returnTo=/shows/works", "Œuvre introuvable"],
	[`/shows/spectacles/${hamlet.id}/editModel/999?returnTo=/shows/spectacles/${hamlet.id}`, "Modèle introuvable"],
	[`/shows/spectacles/${hamlet.id}/deleteModel/999?returnTo=/shows/spectacles/${hamlet.id}`, "Modèle introuvable"],
];

test.describe("show - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
