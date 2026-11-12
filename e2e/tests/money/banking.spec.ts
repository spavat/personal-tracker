import type { Page } from "@playwright/test";

import { expect, queryDb, resetDb, test } from "../../fixtures";

// Bank sync against the fake Enable Banking API (e2e/mocks/enable-banking-mock.mjs): "Mock Bank" has a checking account
// FR7630001007941234567890185 with 3 booked lines (CB CARREFOUR MARKET -42.10, PRLV EDF -60.00, VIR SALAIRE +2000.00)
// and a savings account linked to nothing.
const CHECKING_IBAN = "FR7630001007941234567890185";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);

// seeded "Checking Account" of "Main Bank" (payment type "Card Main Bank")
async function setCheckingIban() {
	await queryDb("UPDATE money.account SET iban = $1 WHERE id = 1", [CHECKING_IBAN]);
}

async function connectMockBank(page: Page) {
	await page.goto("/money/banking/connections");
	await page.getByRole("button", { name: "Connecter une banque" }).click();
	const dialog = page.getByRole("dialog", { name: "Connecter une banque" });
	await dialog.getByRole("combobox", { name: "Banque" }).selectOption("Mock Bank");
	await dialog.getByRole("button", { name: "Continuer vers la banque" }).click();
	// the mock sends the browser back to the callback, which completes the connection
	await expect(page).toHaveURL("/money/banking/connections");
	await expect(page.locator(".bank-connection")).toContainText("Mock Bank");
}

async function sync(page: Page, imported: number) {
	await page.getByRole("button", { name: "Synchroniser" }).click();
	await expect(page.getByText(`${imported} opération(s) importée(s)`)).toBeVisible();
}

function inboxRow(page: Page, label: string) {
	return page.getByRole("row").filter({ hasText: label });
}

test.describe("Bank sync", () => {
	test.afterEach(resetDb);

	test("connecting a bank links its account by IBAN and shows the connection online", async ({ page }) => {
		await setCheckingIban();
		await connectMockBank(page);

		const connection = page.locator(".bank-connection");
		await expect(connection.locator(".connection-status")).toHaveText("En ligne");
		await expect(connection.getByRole("row", { name: /Compte courant/ }).getByRole("combobox")).toHaveValue("1");
		await expect(connection.getByRole("row", { name: /Livret/ }).getByRole("combobox")).toHaveValue("");

		const [row] = await queryDb("SELECT status, session_id FROM money.bank_connection");
		expect(row.status).toBe("authorized");
		expect(row.session_id).toBeTruthy();
	});

	test("a refused authorization is reported on the callback page", async ({ page }) => {
		await page.goto(
			"/money/banking/callback?error=access_denied&error_description=Refus%C3%A9%20par%20l%27utilisateur",
		);
		await expect(page.getByText("Autorisation refusée par la banque : Refusé par l'utilisateur")).toBeVisible();
	});

	test("sync fills the inbox once, a second sync imports nothing", async ({ page }) => {
		await setCheckingIban();
		await connectMockBank(page);
		await sync(page, 3);
		await sync(page, 0);

		await page.goto("/money/banking/inbox");
		await expect(page.getByRole("heading", { name: "Opérations à valider (3)" })).toBeVisible();
		await expect(inboxRow(page, "CB CARREFOUR MARKET")).toContainText("-42.10");
		await expect(inboxRow(page, "VIR SALAIRE")).toContainText("2000.00");

		await page.goto("/money");
		await expect(page.getByRole("link", { name: "3 opération(s) bancaire(s) à valider" })).toBeVisible();
	});

	test("an unlinked bank account is not synced", async ({ page }) => {
		await connectMockBank(page);
		await sync(page, 0);
	});

	test("validating a line creates the transaction and removes it from the inbox", async ({ page }) => {
		await setCheckingIban();
		await connectMockBank(page);
		await sync(page, 3);

		await page.goto("/money/banking/inbox");
		await inboxRow(page, "CB CARREFOUR MARKET").getByRole("button", { name: "Valider" }).click();
		const dialog = page.getByRole("dialog", { name: "Valider une opération bancaire" });
		await expect(dialog.getByRole("textbox", { name: "Nom" })).toHaveValue("CB CARREFOUR MARKET");
		await expect(dialog.getByRole("spinbutton", { name: "Montant" })).toHaveValue("-42.1");
		// only the payment types of the linked account, "CB" suggests the card
		await expect(dialog.getByRole("combobox", { name: "Paiement" })).toHaveValue("1");
		await dialog.getByRole("textbox", { name: "Nom" }).fill("Courses");
		await dialog.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Food" });
		await dialog.getByRole("button", { name: "Enregister" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(inboxRow(page, "CB CARREFOUR MARKET")).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Opérations à valider (2)" })).toBeVisible();

		const [transaction] = await queryDb(
			"SELECT name, amount, date, category_id, payment_type_id, external_id, bank_label FROM money.transaction WHERE name = 'Courses'",
		);
		expect(transaction).toMatchObject({
			amount: "-42.10",
			category_id: 1,
			payment_type_id: 1,
			external_id: "e2e-hash-checking:REF-1",
			bank_label: "CB CARREFOUR MARKET",
		});

		// already a transaction: not imported again
		await page.goto("/money/banking/connections");
		await sync(page, 0);
	});

	test("matching a line links it to the manual transaction", async ({ page }) => {
		await setCheckingIban();
		await queryDb(
			"INSERT INTO money.transaction (name, date, consideration_date, amount, payment_type_id) VALUES ('Électricité', $1, $1, -60, 1)",
			[daysAgo(4)],
		);
		await connectMockBank(page);
		await sync(page, 3);

		await page.goto("/money/banking/inbox");
		await inboxRow(page, "PRLV EDF")
			.getByRole("button", { name: /Rapprocher : Électricité/ })
			.click();
		await expect(inboxRow(page, "PRLV EDF")).toHaveCount(0);

		const rows = await queryDb("SELECT name, external_id, bank_label FROM money.transaction WHERE amount = -60");
		expect(rows).toEqual([{ name: "Électricité", external_id: "e2e-hash-checking:REF-2", bank_label: "PRLV EDF" }]);
	});

	test("an ignored line does not come back on the next sync", async ({ page }) => {
		await setCheckingIban();
		await connectMockBank(page);
		await sync(page, 3);

		await page.goto("/money/banking/inbox");
		await inboxRow(page, "VIR SALAIRE").getByRole("button", { name: "Ignorer" }).click();
		await expect(inboxRow(page, "VIR SALAIRE")).toHaveCount(0);

		await page.goto("/money/banking/connections");
		await sync(page, 0);
		await page.goto("/money/banking/inbox");
		await expect(page.getByRole("heading", { name: "Opérations à valider (2)" })).toBeVisible();
	});

	test("an expired connection is flagged and no longer synced", async ({ page }) => {
		await setCheckingIban();
		await connectMockBank(page);
		await queryDb("UPDATE money.bank_connection SET valid_until = now() - interval '1 day'");

		await page.reload();
		await expect(page.locator(".connection-status")).toHaveText("Expirée");
		await sync(page, 0);

		await page.goto("/money");
		await expect(page.getByRole("link", { name: "Mock Bank : Expirée" })).toBeVisible();
	});

	test("deleting a connection removes it with its inbox", async ({ page }) => {
		await setCheckingIban();
		await connectMockBank(page);
		await sync(page, 3);

		page.once("dialog", (d) => d.accept());
		await page.getByRole("button", { name: "Supprimer" }).click();
		await expect(page.getByText("Aucune banque connectée.")).toBeVisible();
		expect(await queryDb("SELECT id FROM money.bank_transaction")).toEqual([]);
	});
});
