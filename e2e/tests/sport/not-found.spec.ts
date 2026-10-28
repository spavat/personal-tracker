import { expect, test } from "../../fixtures";

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	[`/sport/list/edit/${UNKNOWN}?returnTo=/sport/list`, "Activité introuvable"],
	[`/sport/list/delete/${UNKNOWN}?returnTo=/sport/list`, "Activité introuvable"],
];

test.describe("sport - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
