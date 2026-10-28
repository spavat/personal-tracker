import { expect, SEED, test } from "../../fixtures";

const { souris } = SEED.lifespan.objects;
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/lifespan/categories/edit/${UNKNOWN}?returnTo=/lifespan/categories`, "Catégorie introuvable"],
	[`/lifespan/categories/delete/${UNKNOWN}?returnTo=/lifespan/categories`, "Catégorie introuvable"],
	[`/lifespan/list/${UNKNOWN}/edit?returnTo=/lifespan/list`, "Objet introuvable"],
	[`/lifespan/list/${UNKNOWN}/delete?returnTo=/lifespan/list`, "Objet introuvable"],
	[`/lifespan/list/${souris.id}/event/${UNKNOWN}/edit?returnTo=/lifespan/list`, "Évènement introuvable"],
	[`/lifespan/list/${souris.id}/event/${UNKNOWN}/delete?returnTo=/lifespan/list`, "Évènement introuvable"],
];

test.describe("lifespan - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
