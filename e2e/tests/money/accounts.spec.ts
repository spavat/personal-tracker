import type { Page } from "@playwright/test";

import { expect, test, resetDb } from "../../fixtures";

// The page is a tree: bank > account > payment type. Only bank names are in <b>.
function bankSummary(page: Page, bankName: string) {
	return page.locator("summary").filter({ has: page.getByText(bankName, { exact: true }) });
}

function accountSummary(page: Page, bankName: string, accountName: string) {
	return page
		.locator("ul.tree > li")
		.filter({ has: page.getByText(bankName, { exact: true }) })
		.locator("li summary")
		.filter({ hasText: accountName });
}

// Payment types are the leaves of the tree
function paymentTypeItem(page: Page, paymentTypeName: string) {
	return page.locator("ul.tree li").filter({ hasText: paymentTypeName, hasNot: page.locator("li") });
}

async function addBank(page: Page, name: string) {
	await page.getByRole("button", { name: "Ajouter une banque" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter une banque" });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("textbox", { name: "Nom" }).fill(name);
	await dialog.getByRole("button", { name: "Enregistrer" }).click();
	await expect(dialog).not.toBeVisible();
}

async function addAccount(page: Page, name: string, bankName: string) {
	await page.getByRole("button", { name: "Ajouter un compte" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter un compte" });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("textbox", { name: "Nom" }).fill(name);
	await dialog.getByRole("textbox", { name: "Icone" }).fill("fa-solid fa-wallet");
	await dialog.getByLabel("Couleur du fond").fill("#a0db28");
	await dialog.getByLabel("Couleur du texte").fill("#000000");
	await dialog.getByRole("combobox", { name: "Banque" }).selectOption({ label: bankName });
	await dialog.getByRole("button", { name: "Enregistrer" }).click();
	await expect(dialog).not.toBeVisible();
}

test.describe("Accounts", () => {
	test.afterEach(resetDb);

	test("accounts page loads", async ({ page }) => {
		await page.goto("/money/accounts");
		await expect(page.getByRole("heading", { name: "Configuration des comptes" })).toBeVisible();
		await expect(bankSummary(page, "Main Bank")).toBeVisible();
		await expect(bankSummary(page, "Secondary Bank")).toBeVisible();
		await expect(bankSummary(page, "General")).toBeVisible();
	});

	test.describe("Banks", () => {
		test("add a bank", async ({ page }) => {
			await page.goto("/money/accounts");
			await addBank(page, "Third Bank");
			await expect(bankSummary(page, "Third Bank")).toBeVisible();
		});

		test("update a bank", async ({ page }) => {
			await page.goto("/money/accounts");
			await bankSummary(page, "General").getByRole("button", { name: "Modifier" }).click();
			const dialog = page.getByRole("dialog", { name: "Editer une banque" });
			await expect(dialog).toBeVisible();
			// Wait for the form to be prefilled before editing
			const nameInput = dialog.getByRole("textbox", { name: "Nom" });
			await expect(nameInput).toHaveValue("General");
			await nameInput.fill("Other Bank");
			await dialog.getByRole("button", { name: "Enregistrer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(bankSummary(page, "Other Bank")).toBeVisible();
			await expect(bankSummary(page, "General")).not.toBeVisible();
		});

		test("delete a bank without accounts", async ({ page }) => {
			await page.goto("/money/accounts");
			await addBank(page, "Temporary Bank");

			await bankSummary(page, "Temporary Bank").getByRole("button", { name: "Supprimer" }).click();
			const dialog = page.getByRole("dialog", { name: 'Supprimer la banque "Temporary Bank"' });
			await expect(dialog).toBeVisible();
			await expect(dialog).toContainText("✅ Aucun");
			await dialog.getByRole("button", { name: "Supprimer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(bankSummary(page, "Temporary Bank")).not.toBeVisible();
		});

		test("cannot delete Main Bank (has accounts)", async ({ page }) => {
			await page.goto("/money/accounts");
			await bankSummary(page, "Main Bank").getByRole("button", { name: "Supprimer" }).click();
			const dialog = page.getByRole("dialog", { name: 'Supprimer la banque "Main Bank"' });
			await expect(dialog).toBeVisible();
			await expect(dialog).toContainText("2 compte(s)");
			await expect(dialog.getByRole("button", { name: "Supprimer" })).toBeDisabled();
		});

		test("cannot delete Secondary Bank (has accounts)", async ({ page }) => {
			await page.goto("/money/accounts");
			await bankSummary(page, "Secondary Bank").getByRole("button", { name: "Supprimer" }).click();
			const dialog = page.getByRole("dialog", { name: 'Supprimer la banque "Secondary Bank"' });
			await expect(dialog).toBeVisible();
			await expect(dialog).toContainText("1 compte(s)");
			await expect(dialog.getByRole("button", { name: "Supprimer" })).toBeDisabled();
		});
	});

	test.describe("Accounts", () => {
		test("add an account", async ({ page }) => {
			await page.goto("/money/accounts");
			await addAccount(page, "Savings", "Secondary Bank");
			await expect(accountSummary(page, "Secondary Bank", "Savings")).toBeVisible();
		});

		test("update an account", async ({ page }) => {
			await page.goto("/money/accounts");
			await accountSummary(page, "Main Bank", "Livret A").getByRole("button", { name: "Modifier" }).click();
			const dialog = page.getByRole("dialog", { name: "Editer un compte" });
			await expect(dialog).toBeVisible();
			// Wait for the form to be prefilled before editing
			const nameInput = dialog.getByRole("textbox", { name: "Nom" });
			await expect(nameInput).toHaveValue("Livret A");
			await nameInput.fill("Livret Jeune");
			await dialog.getByRole("button", { name: "Enregistrer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(accountSummary(page, "Main Bank", "Livret Jeune")).toBeVisible();
			await expect(accountSummary(page, "Main Bank", "Livret A")).not.toBeVisible();
		});

		test("delete an account", async ({ page }) => {
			// Seeded accounts all have history, so they can't be deleted: create a fresh one
			await page.goto("/money/accounts");
			await addAccount(page, "Temporary Account", "General");

			await accountSummary(page, "General", "Temporary Account")
				.getByRole("button", { name: "Supprimer" })
				.click();
			const dialog = page.getByRole("dialog", { name: 'Supprimer le compte "Temporary Account"' });
			await expect(dialog).toBeVisible();
			await dialog.getByRole("button", { name: "Supprimer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(accountSummary(page, "General", "Temporary Account")).not.toBeVisible();
		});
	});

	test.describe("Payment types", () => {
		test("add a payment type", async ({ page }) => {
			await page.goto("/money/accounts");
			await page.getByRole("button", { name: "Ajouter un type de paiement" }).click();
			const dialog = page.getByRole("dialog", { name: "Ajouter un type de paiement" });
			await expect(dialog).toBeVisible();
			await dialog.getByRole("textbox", { name: "Nom" }).fill("Visa");
			await dialog.getByRole("textbox", { name: "Icone" }).fill("fa-brands fa-cc-visa");
			await dialog.getByLabel("Couleur du fond").fill("#1a1f71");
			await dialog.getByLabel("Couleur du texte").fill("#ffffff");
			await dialog.getByRole("combobox", { name: "Compte" }).selectOption({ label: "Livret A" });
			await dialog.getByRole("button", { name: "Enregistrer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(paymentTypeItem(page, "Visa")).toBeVisible();
		});

		test("update a payment type", async ({ page }) => {
			await page.goto("/money/accounts");
			await paymentTypeItem(page, "Cash").getByRole("button", { name: "Modifier" }).click();
			const dialog = page.getByRole("dialog", { name: "Editer un type de paiement" });
			await expect(dialog).toBeVisible();
			// Wait for the form to be prefilled before editing
			const nameInput = dialog.getByRole("textbox", { name: "Nom" });
			await expect(nameInput).toHaveValue("Cash");
			await nameInput.fill("Wallet");
			await dialog.getByRole("button", { name: "Enregistrer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(paymentTypeItem(page, "Wallet")).toBeVisible();
			await expect(paymentTypeItem(page, "Cash")).not.toBeVisible();
		});

		test("delete a payment type", async ({ page }) => {
			await page.goto("/money/accounts");
			await paymentTypeItem(page, "Card Secondary Bank").getByRole("button", { name: "Supprimer" }).click();
			const dialog = page.getByRole("dialog", { name: 'Supprimer le type de paiement "Card Secondary Bank"' });
			await expect(dialog).toBeVisible();
			await dialog.getByRole("button", { name: "Supprimer" }).click();
			// Assertion
			await expect(dialog).not.toBeVisible();
			await expect(paymentTypeItem(page, "Card Secondary Bank")).not.toBeVisible();
		});
	});
});
