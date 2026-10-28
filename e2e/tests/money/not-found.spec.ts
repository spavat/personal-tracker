import { expect, test } from "../../fixtures";

// Opened from a stale or typed URL: the modal says so instead of showing an empty form
const CASES: Array<[string, string]> = [
	["/money/accounts/account/999/edit?returnTo=/money/accounts", "Compte introuvable"],
	["/money/accounts/account/999/delete?returnTo=/money/accounts", "Compte introuvable"],
	["/money/accounts/bank/999/edit?returnTo=/money/accounts", "Banque introuvable"],
	["/money/accounts/bank/999/delete?returnTo=/money/accounts", "Banque introuvable"],
	["/money/accounts/paymentType/999/edit?returnTo=/money/accounts", "Moyen de paiement introuvable"],
	["/money/accounts/paymentType/999/delete?returnTo=/money/accounts", "Moyen de paiement introuvable"],
	["/money/categories/999/edit?returnTo=/money/categories", "Catégorie introuvable"],
	["/money/categories/999/delete?returnTo=/money/categories", "Catégorie introuvable"],
	["/money/tags/999/edit?returnTo=/money/tags", "Tag introuvable"],
	["/money/tags/999/delete?returnTo=/money/tags", "Tag introuvable"],
	[
		"/money/transactions/2026-10/transaction/999/edit?returnTo=/money/transactions/2026-10",
		"Transaction introuvable",
	],
	[
		"/money/transactions/2026-10/transaction/999/delete?returnTo=/money/transactions/2026-10",
		"Transaction introuvable",
	],
];

test.describe("money - Unknown items", () => {
	for (const [url, message] of CASES) {
		test(`${url} shows ${message}`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByRole("dialog", { name: "Erreur" })).toContainText(message);
		});
	}
});
