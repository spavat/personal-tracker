import type { Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { alice, littleWomen } = SEED.book;

// Served by e2e/mocks/fetch-mock.mjs
const PORTRAIT_URL = "https://images.example.com/book-cover.svg";
const SVG_PORTRAIT = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="90" fill="teal"/></svg>',
);

test.describe("Reading Book - Authors", () => {
	test.afterEach(resetDb);

	test("list the authors and open one", async ({ page }) => {
		await page.goto("/reading-book/history/2026");
		await page.getByRole("link", { name: "Auteur·ices" }).click();
		await expect(page).toHaveURL("/reading-book/authors");

		// cards by default
		const cards = page.locator(".grid.authors .card_item");
		await expect(cards).toHaveCount(3);
		await expect(cards.filter({ hasText: "Lewis Carroll" })).toContainText("1 livre · 1 lecture");

		// as a list, with the index
		await page.getByRole("combobox", { name: "Affichage" }).selectOption("Liste");
		const carroll = page.locator("table.authors tbody tr").filter({ hasText: "Lewis Carroll" });
		await expect(carroll.locator("td")).toHaveText(["1", "Lewis Carroll", "1", "1"]);
		await expect(page.locator("table.authors tbody tr")).toHaveCount(3);

		await carroll.getByRole("link", { name: "Lewis Carroll" }).click();
		await expect(page.getByRole("heading", { name: "Lewis Carroll" })).toBeVisible();

		await expect(page.getByRole("link", { name: alice.book })).toBeVisible();
		await expect(page.getByRole("link", { name: littleWomen.book })).toHaveCount(0);

		// the submenu leads back to the list
		await page.getByRole("link", { name: "Auteur·ices" }).click();
		await expect(page).toHaveURL("/reading-book/authors");
	});

	test("an author in the book list links to their page", async ({ page }) => {
		await page.goto("/reading-book/list");
		const row = page.locator("table.books tbody tr").filter({ hasText: alice.book });
		await row.getByRole("link", { name: "Lewis Carroll" }).click();
		await expect(page).toHaveURL(/\/reading-book\/authors\/[0-9a-f-]+$/);
		await expect(page.getByRole("heading", { name: "Lewis Carroll" })).toBeVisible();
	});

	test("an author on the book page links to their page", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		await page.locator(".details .general").getByRole("link", { name: "Lewis Carroll" }).click();
		await expect(page).toHaveURL(/\/reading-book\/authors\/[0-9a-f-]+$/);
		await expect(page.getByRole("heading", { name: "Lewis Carroll" })).toBeVisible();
	});

	test("credit an author under another name", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		await page.getByRole("heading", { name: alice.book }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le livre" });
		await dialog.getByRole("textbox", { name: "Auteur·ice 1 crédité·e comme" }).fill("L. Carroll");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		// the book shows the credited name, the author keeps theirs
		await expect(page.locator(".details .general")).toContainText("Auteur.ic.es: L. Carroll");
		await page.locator(".details .general").getByRole("link", { name: "L. Carroll" }).click();
		await expect(page.getByRole("heading", { name: "Lewis Carroll" })).toBeVisible();
	});

	test("rename a author and give them a sort name", async ({ page }) => {
		await openAuthor(page, "Lewis Carroll");
		const dialog = await openEditModal(page);
		await expect(dialog.getByRole("textbox", { name: "Nom *", exact: true })).toHaveValue("Lewis Carroll");
		await dialog.getByRole("textbox", { name: "Nom *", exact: true }).fill("Lewis Carroll (C. L. Dodgson)");
		await dialog.getByRole("textbox", { name: "Nom de tri" }).fill("Carroll, Lewis");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await expect(page.getByRole("heading", { name: "Lewis Carroll (C. L. Dodgson)" })).toBeVisible();
		// the books show the entity's new name
		await page.goto(`/reading-book/book/${alice.id}`);
		await expect(page.locator(".details .general")).toContainText("Auteur.ic.es: Lewis Carroll (C. L. Dodgson)");
	});

	test("add a portrait from a URL, then remove it", async ({ page }) => {
		await openAuthor(page, "Lewis Carroll");
		let dialog = await openEditModal(page);
		await dialog.getByRole("textbox", { name: "URL de l'image" }).fill(PORTRAIT_URL);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const portrait = page.getByRole("img", { name: "Portrait de Lewis Carroll" });
		await expect(portrait).toHaveAttribute("src", /\/images\/entity\/[0-9a-f-]+\?v=[0-9a-f]+$/);
		// served by the images proxy
		await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

		dialog = await openEditModal(page);
		await dialog.getByRole("button", { name: "Retirer le portrait" }).click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(portrait).toHaveCount(0);
	});

	test("paste an image: it opens the cropper", async ({ page }) => {
		await openAuthor(page, "Lewis Carroll");
		const dialog = await openEditModal(page);
		await expect(dialog.getByText("ou coller une image (Ctrl+V)")).toBeVisible();
		// a paste event carrying an image file, as the browser sends it
		await page.evaluate((svg) => {
			const data = new DataTransfer();
			data.items.add(new File([svg], "pasted.svg", { type: "image/svg+xml" }));
			window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data }));
		}, SVG_PORTRAIT.toString());
		await expect(dialog.getByRole("button", { name: "Valider" })).toBeVisible();
	});

	test("crop a portrait from a file", async ({ page }) => {
		await openAuthor(page, "Lewis Carroll");
		const dialog = await openEditModal(page);
		await dialog
			.getByLabel("Fichier image")
			.setInputFiles({ name: "portrait.svg", mimeType: "image/svg+xml", buffer: SVG_PORTRAIT });
		// saving waits for the crop
		await expect(dialog.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
		await dialog.getByRole("button", { name: "Valider" }).click();
		await expect(dialog.getByRole("img", { name: "Portrait" })).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await expect(page.getByRole("img", { name: "Portrait de Lewis Carroll" })).toBeVisible();
	});
});

async function openAuthor(page: Page, name: string) {
	await page.goto("/reading-book/authors");
	await page.getByRole("link", { name }).click();
	await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function openEditModal(page: Page) {
	await page.locator(".presentation-with-picture").getByRole("button", { name: "Modifier" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier l'auteur·ice" });
	await expect(dialog).toBeVisible();
	return dialog;
}
