import type { Locator, Page } from "@playwright/test";

import { expect, resetDb, SEED, test } from "../../fixtures";

const { alice, littleWomen, roman } = SEED.book;

// the picker of a row (components/SearchSelect): no creation, only existing books or series
async function pick(dialog: Locator, label: string, title: string) {
	const input = dialog.getByRole("textbox", { name: label, exact: true });
	await input.fill(title.slice(0, 8));
	await dialog.page().locator(".search-select-item").getByText(title, { exact: true }).click();
	await expect(input).toHaveValue(title);
}
const pickBook = (dialog: Locator, row: number, title: string) => pick(dialog, `Livre ${row}`, title);
const pickSeries = (dialog: Locator, row: number, title: string) => pick(dialog, `Série ${row}`, title);

// a series of these books, from the series list; ends on its page
async function createSeries(page: Page, title: string, books: string[]) {
	await page.goto("/reading-book/series");
	await page.getByRole("button", { name: "Ajouter une série" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter une série" });
	await dialog.getByRole("textbox", { name: "Titre" }).fill(title);
	for (const [i, book] of books.entries()) {
		await dialog.getByRole("button", { name: "Ajouter un livre" }).click();
		await pickBook(dialog, i + 1, book);
	}
	await dialog.getByRole("button", { name: "Enregistrer" }).click();
	await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
	return page.url().split("/").pop() as string;
}

async function openEdit(page: Page, title: string) {
	await page.getByRole("heading", { name: title, level: 2 }).getByRole("button", { name: "Modifier" }).click();
	return page.getByRole("dialog", { name: "Modifier la série" });
}

// the books' "#n" and labels of a page, in order
function readingOrders(scope: Page | Locator) {
	return scope.locator(".card_item .reading-order");
}

async function createClassics(page: Page) {
	await page.goto("/reading-book/series");
	await page.getByRole("button", { name: "Ajouter une série", exact: true }).first().click();
	const dialog = page.getByRole("dialog", { name: "Ajouter une série" });
	await dialog.getByRole("textbox", { name: "Titre" }).fill("Classiques");
	await dialog.getByRole("button", { name: "Ajouter un livre" }).click();
	// the new row's book picker gets the focus
	await expect(dialog.getByRole("textbox", { name: "Livre 1", exact: true })).toBeFocused();
	await pickBook(dialog, 1, alice.book);
	await dialog.getByRole("button", { name: "Ajouter un livre" }).click();
	// the next number is pre-filled
	await expect(dialog.getByRole("textbox", { name: "Numéro 2" })).toHaveValue("2");
	await pickBook(dialog, 2, littleWomen.book);
	await dialog.getByRole("button", { name: "Enregistrer" }).click();
	await expect(page.getByRole("heading", { name: "Classiques" })).toBeVisible();
}

function cards(page: Page) {
	return page.locator(".details .grid .card_item");
}

test.describe("Reading Book - Series", () => {
	test.afterEach(resetDb);

	test("create a series: its books in order, with their label", async ({ page }) => {
		await createClassics(page);
		await expect(page).toHaveURL(/\/reading-book\/series\/[0-9a-f-]+$/);
		await expect(cards(page).locator(".series-label")).toHaveText(["1", "2"]);
		await expect(cards(page).locator(".title")).toHaveText([alice.book, littleWomen.book]);

		await page.getByRole("link", { name: "Séries" }).click();
		await expect(page.locator("table.series tbody tr").locator("td")).toHaveText(["1", "Classiques", "2"]);
	});

	test("insert an interlude: the positions change, not the labels", async ({ page }) => {
		await createClassics(page);
		await page.getByRole("heading", { name: "Classiques" }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier la série" });
		await dialog.getByRole("button", { name: "Ajouter un livre" }).click();
		await pickBook(dialog, 3, roman.book);
		await dialog.getByRole("textbox", { name: "Numéro 3" }).fill("interlude");

		// dragged by its handle between the first and the second book
		const handles = dialog.locator(".drag-handle");
		const from = (await handles.nth(2).boundingBox())!;
		const to = (await handles.nth(1).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		for (let step = 1; step <= 10; step++) {
			await page.mouse.move(from.x + from.width / 2, from.y + ((to.y - from.y) * step) / 10 + from.height / 2);
		}
		await page.mouse.up();
		await expect(dialog.getByRole("textbox", { name: "Livre 2", exact: true })).toHaveValue(roman.book);

		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(cards(page).locator(".title")).toHaveText([alice.book, roman.book, littleWomen.book]);
		await expect(cards(page).locator(".series-label")).toHaveText(["1", "interlude", "2"]);
	});

	test("the book and author pages show the series", async ({ page }) => {
		await createClassics(page);

		await page.goto(`/reading-book/book/${alice.id}`);
		await expect(page.locator(".details .general")).toContainText("Série : Classiques #1");
		await page.locator(".details .general").getByRole("link", { name: "Classiques" }).click();
		await expect(page.getByRole("heading", { name: "Classiques" })).toBeVisible();

		// the author's entity page: the books by series
		await page.goto(`/reading-book/book/${alice.id}`);
		await page.locator(".details .general").getByRole("link", { name: "Lewis Carroll" }).click();
		const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Classiques" }) });
		await expect(section.locator(".card_item .series-label")).toHaveText(["1"]);
	});

	test("delete a series: its books stay", async ({ page }) => {
		await createClassics(page);
		await page.getByRole("heading", { name: "Classiques" }).getByRole("button", { name: "Supprimer" }).click();
		await page
			.getByRole("dialog", { name: "Supprimer la série" })
			.getByRole("button", { name: "Supprimer" })
			.click();

		await expect(page).toHaveURL("/reading-book/series");
		await expect(page.locator("table.series tbody tr")).toHaveCount(0);
		await page.goto(`/reading-book/book/${alice.id}`);
		await expect(page.locator(".details .general")).not.toContainText("Série");
	});

	test("a sub-series: its tree, the books numbered in reading order over the whole series", async ({ page }) => {
		await createSeries(page, "Le Seigneur des anneaux", [alice.book, littleWomen.book]);
		await createSeries(page, "Terre du Milieu", [roman.book]);
		const dialog = await openEdit(page, "Terre du Milieu");
		await dialog.getByRole("button", { name: "Ajouter une série" }).click();
		await expect(dialog.getByRole("textbox", { name: "Série 2", exact: true })).toBeFocused();
		await pickSeries(dialog, 2, "Le Seigneur des anneaux");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		// 1. Roman (#1), 2. Le Seigneur des anneaux (1. Alice #2, 2. Little Women #3)
		await expect(page.locator(".details > .grid .card_item .title")).toHaveText([roman.book]);
		const lotr = page
			.locator(".sub-series")
			.filter({ has: page.getByRole("heading", { name: "Le Seigneur des anneaux" }) });
		await expect(lotr.getByRole("heading")).toHaveText("2Le Seigneur des anneaux");
		await expect(lotr.locator(".card_item .series-label")).toHaveText(["1", "2"]);
		await expect(readingOrders(page)).toHaveText(["#1", "#2", "#3"]);

		// its own page numbers from #1, and says where it is
		await lotr.getByRole("heading", { name: "Le Seigneur des anneaux" }).getByRole("link").click();
		await expect(page.getByText("Dans : Terre du Milieu")).toBeVisible();
		await expect(readingOrders(page)).toHaveText(["#1", "#2"]);

		// the book page shows the path
		await page.goto(`/reading-book/book/${alice.id}`);
		await expect(page.locator(".details .general")).toContainText(
			"Série : Terre du Milieu › Le Seigneur des anneaux #1",
		);
	});

	test("a book inserted before a sub-series: the reading order shifts, not the labels", async ({ page }) => {
		await createSeries(page, "Le Seigneur des anneaux", [alice.book]);
		await createSeries(page, "Terre du Milieu", [littleWomen.book]);
		let dialog = await openEdit(page, "Terre du Milieu");
		await dialog.getByRole("button", { name: "Ajouter une série" }).click();
		await pickSeries(dialog, 2, "Le Seigneur des anneaux");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(readingOrders(page)).toHaveText(["#1", "#2"]);

		dialog = await openEdit(page, "Terre du Milieu");
		await dialog.getByRole("button", { name: "Ajouter un livre" }).click();
		await pickBook(dialog, 3, roman.book);
		await dialog.getByRole("textbox", { name: "Numéro 3" }).fill("1.5");
		// dragged between the book and the sub-series
		const handles = dialog.locator(".drag-handle");
		const from = (await handles.nth(2).boundingBox())!;
		const to = (await handles.nth(1).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		for (let step = 1; step <= 10; step++) {
			await page.mouse.move(from.x + from.width / 2, from.y + ((to.y - from.y) * step) / 10 + from.height / 2);
		}
		await page.mouse.up();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await expect(page.locator(".details > .grid .card_item .series-label")).toHaveText(["1", "1.5"]);
		await expect(readingOrders(page)).toHaveText(["#1", "#2", "#3"]);
		const lotr = page.locator(".sub-series");
		await expect(lotr.getByRole("heading")).toHaveText("2Le Seigneur des anneaux");
		await expect(readingOrders(lotr)).toHaveText(["#3"]);
	});

	test("a sub-series in two parents, and no cycle offered", async ({ page }) => {
		const lotrId = await createSeries(page, "Le Seigneur des anneaux", [alice.book]);
		for (const parent of ["Terre du Milieu", "Œuvres de Tolkien"]) {
			await createSeries(page, parent, []);
			const dialog = await openEdit(page, parent);
			await dialog.getByRole("button", { name: "Ajouter une série" }).click();
			await pickSeries(dialog, 1, "Le Seigneur des anneaux");
			await dialog.getByRole("button", { name: "Enregistrer" }).click();
			await expect(dialog).not.toBeVisible();
		}
		await page.goto(`/reading-book/series/${lotrId}`);
		await expect(page.getByText("Dans : Œuvres de Tolkien, Terre du Milieu")).toBeVisible();

		// Le Seigneur des anneaux can't hold a series holding it, nor itself
		const dialog = await openEdit(page, "Le Seigneur des anneaux");
		await dialog.getByRole("button", { name: "Ajouter une série" }).click();
		await dialog.getByRole("textbox", { name: "Série 2", exact: true }).fill("");
		await expect(page.locator(".search-select-results")).toContainText("Aucune série");

		await page.goto("/reading-book/series");
		await expect(
			page.locator("table.series tbody tr").filter({ hasText: "Le Seigneur des anneaux" }),
		).toContainText("dans Œuvres de Tolkien, Terre du Milieu");
	});

	test("delete a sub-series: it leaves its parents, its books stay", async ({ page }) => {
		const lotrId = await createSeries(page, "Le Seigneur des anneaux", [alice.book]);
		await createSeries(page, "Terre du Milieu", [roman.book]);
		let dialog = await openEdit(page, "Terre du Milieu");
		await dialog.getByRole("button", { name: "Ajouter une série" }).click();
		await pickSeries(dialog, 2, "Le Seigneur des anneaux");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		const middleEarth = page.url();

		await page.goto(`/reading-book/series/${lotrId}`);
		await page
			.getByRole("heading", { name: "Le Seigneur des anneaux", level: 2 })
			.getByRole("button", { name: "Supprimer" })
			.click();
		dialog = page.getByRole("dialog", { name: "Supprimer la série" });
		await dialog.getByRole("button", { name: "Supprimer" }).click();

		await page.goto(middleEarth);
		await expect(page.locator(".sub-series")).toHaveCount(0);
		await expect(readingOrders(page)).toHaveText(["#1"]);
		await page.goto(`/reading-book/book/${alice.id}`);
		await expect(page.getByRole("heading", { name: alice.book })).toBeVisible();
	});
});
