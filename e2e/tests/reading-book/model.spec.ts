import type { Locator, Page } from "@playwright/test";

import { expect, pickEntity, resetDb, SEED, test } from "../../fixtures";

const { roman } = SEED.book;
const ROMAN_CHAPTERS = 19;

// The seeded books and a new book have one model
async function openModelModal(page: Page, bookId: string) {
	await page.goto(`/reading-book/book/${bookId}`);
	await detailsModel(page).getByRole("button", { name: "Modifier le modèle" }).click();
	const dialog = page.getByRole("dialog", { name: "Modifier le modèle" });
	await expect(dialog).toBeVisible();
	return dialog;
}

// The modal has 3 columns: "Texte", "Saisie" and "Prévisualisation"
function column(dialog: Locator, name: string) {
	return dialog.locator(".modele-form > div").filter({ has: dialog.page().getByRole("heading", { name }) });
}

// Model shown on the details page
function detailsModel(page: Page, name = "Modèle") {
	return page.locator(".card_item.model").filter({ has: page.getByRole("heading", { name }) });
}

function edition(page: Page, title: string) {
	return page.locator("section.edition").filter({ has: page.getByRole("heading", { name: title, level: 3 }) });
}

async function createBook(page: Page, name: string) {
	await page.goto("/reading-book/list");
	await page.getByRole("button", { name: "Ajouter un livre" }).click();
	const dialog = page.getByRole("dialog", { name: "Ajouter un livre" });
	await pickEntity(dialog, "Auteur·ice 1", "Model Author");
	await dialog.getByRole("textbox", { name: "Nom" }).fill(name);
	await dialog.getByRole("button", { name: "Enregistrer" }).click();
	await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
	return page.url().split("/").pop() as string;
}

test.describe("Reading Book - Model", () => {
	test.afterEach(resetDb);

	test("modal shows the existing chapters", async ({ page }) => {
		const dialog = await openModelModal(page, roman.id);
		await expect(column(dialog, "Saisie").getByRole("textbox")).toHaveCount(ROMAN_CHAPTERS);
		await expect(column(dialog, "Saisie").getByRole("textbox").first()).toHaveValue(
			"Au commencement était le printemps",
		);
		await expect(column(dialog, "Prévisualisation").locator("ul ul > li")).toHaveCount(ROMAN_CHAPTERS);
	});

	test("build the model from a text", async ({ page }) => {
		const bookId = await createBook(page, "Model Book");
		const dialog = await openModelModal(page, bookId);

		await column(dialog, "Texte")
			.getByRole("textbox")
			.fill("Part 1\n\tChapter 1\n\tChapter 2\nPart 2\n\tChapter 3");
		await expect(column(dialog, "Saisie").getByRole("textbox")).toHaveCount(5);
		await expect(column(dialog, "Prévisualisation").locator("b")).toHaveText(["Part 1", "Part 2"]);

		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const model = detailsModel(page);
		await expect(model.locator("b")).toHaveText(["Part 1", "Part 2"]);
		await expect(model.locator("li li li")).toHaveText(["Chapter 1", "Chapter 2", "Chapter 3"]);
	});

	test("rename a chapter", async ({ page }) => {
		const dialog = await openModelModal(page, roman.id);
		await column(dialog, "Saisie").getByRole("textbox").first().fill("Nouveau titre");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		await expect(detailsModel(page).locator("ul ul > li").first()).toHaveText("Nouveau titre");
	});

	test("add a chapter", async ({ page }) => {
		const dialog = await openModelModal(page, roman.id);
		await column(dialog, "Saisie").getByTitle("Ajouter un chapitre").first().click();
		await expect(column(dialog, "Saisie").getByRole("textbox")).toHaveCount(ROMAN_CHAPTERS + 1);
		// A title is required to save
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(column(dialog, "Saisie").getByText("Titre obligatoire")).toHaveCount(1);
		await expect(dialog).toBeVisible();

		// The new chapter is inserted after the clicked one
		await column(dialog, "Saisie").getByRole("textbox").nth(1).fill("Nouveau chapitre");

		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const chapters = detailsModel(page).locator("ul ul > li");
		await expect(chapters).toHaveCount(ROMAN_CHAPTERS + 1);
		await expect(chapters.nth(1)).toHaveText("Nouveau chapitre");
	});

	test("delete a chapter", async ({ page }) => {
		const dialog = await openModelModal(page, roman.id);
		await column(dialog, "Saisie").getByTitle("Supprimer le chapitre").first().click();
		await expect(column(dialog, "Saisie").getByRole("textbox")).toHaveCount(ROMAN_CHAPTERS - 1);

		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const chapters = detailsModel(page).locator("ul ul > li");
		await expect(chapters).toHaveCount(ROMAN_CHAPTERS - 1);
		await expect(detailsModel(page)).not.toContainText("Au commencement était le printemps");
	});

	test("switch a chapter to a part and back", async ({ page }) => {
		const dialog = await openModelModal(page, roman.id);
		const saisie = column(dialog, "Saisie");

		// Leaf -> node: the chapter gets an empty child
		await saisie.getByRole("button", { name: "Switch" }).first().click();
		await expect(saisie.getByRole("textbox")).toHaveCount(ROMAN_CHAPTERS + 1);
		await expect(column(dialog, "Prévisualisation").locator("b")).toHaveText([
			"Au commencement était le printemps",
		]);

		// Node -> leaf
		await saisie.getByRole("button", { name: "Switch" }).first().click();
		await expect(saisie.getByRole("textbox")).toHaveCount(ROMAN_CHAPTERS);
		await expect(column(dialog, "Prévisualisation").locator("b")).toHaveCount(0);
	});

	test("save a chapter switched to a part", async ({ page }) => {
		const dialog = await openModelModal(page, roman.id);
		const saisie = column(dialog, "Saisie");
		await saisie.getByRole("button", { name: "Switch" }).first().click();
		await saisie.getByRole("textbox").nth(1).fill("Sous-chapitre");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		const model = detailsModel(page);
		await expect(model.locator("b")).toHaveText(["Au commencement était le printemps"]);
		await expect(model.locator("li li li").first()).toHaveText("Sous-chapitre");
	});

	test("cancel does not save the model", async ({ page }) => {
		const dialog = await openModelModal(page, roman.id);
		await column(dialog, "Saisie").getByRole("textbox").first().fill("Nouveau titre");
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).not.toBeVisible();

		await page.reload();
		await expect(detailsModel(page).locator("ul ul > li").first()).toHaveText("Au commencement était le printemps");
	});

	test("add a second model and use it for a new edition", async ({ page }) => {
		await page.goto(`/reading-book/book/${roman.id}`);
		await page.getByRole("button", { name: "Ajouter un modèle" }).click();
		const dialog = page.getByRole("dialog", { name: "Ajouter un modèle" });
		// a name is required
		await column(dialog, "Texte").getByRole("textbox").fill("Prologue\nÉpilogue");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
		await dialog.getByRole("textbox", { name: "Nom du modèle" }).fill("Édition courte");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(detailsModel(page, "Édition courte").locator("ul ul > li")).toHaveText(["Prologue", "Épilogue"]);

		await page.getByRole("button", { name: "Ajouter une édition" }).click();
		const editionDialog = page.getByRole("dialog", { name: "Ajouter une édition" });
		await editionDialog.getByRole("textbox", { name: "Titre de l'édition" }).fill("Poche");
		// a new edition gets the first model (by name)
		await expect(editionDialog.getByRole("combobox", { name: "Modèle" })).toHaveValue(/.+/);
		await editionDialog.getByRole("combobox", { name: "Modèle" }).selectOption("Édition courte");
		await editionDialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(editionDialog).not.toBeVisible();
		await expect(detailsModel(page, "Édition courte")).toContainText("Utilisé par : Poche");

		// its readings follow its model
		const poche = edition(page, "Poche");
		await poche.getByRole("button", { name: "+ Commencer une lecture" }).click();
		await expect(poche.locator(".card_item").getByText("Prologue")).toBeVisible();
	});

	test("the model of an edition with readings is locked", async ({ page }) => {
		await page.goto(`/reading-book/book/${roman.id}`);
		await page.getByRole("button", { name: "Modifier l'édition" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier l'édition" });
		await expect(dialog.getByRole("combobox", { name: "Modèle" })).toBeDisabled();
		await expect(dialog).toContainText("Cette édition a des lectures : son modèle ne change plus.");

		// the other fields still save, the model is kept
		await dialog.getByRole("spinbutton", { name: "Pages" }).fill("300");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expect(detailsModel(page)).toContainText("Utilisé par : Édition");
	});

	test("a model used by an edition with readings can't be deleted", async ({ page }) => {
		await page.goto(`/reading-book/book/${roman.id}`);
		await detailsModel(page).getByRole("button", { name: "Supprimer le modèle" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer le modèle" });
		await expect(dialog).toContainText("Ce modèle est utilisé par une édition qui a des lectures");
		await expect(dialog.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
	});

	test("delete a model: its editions are left without model", async ({ page }) => {
		const bookId = await createBook(page, "Model Book");
		await detailsModel(page).getByRole("button", { name: "Supprimer le modèle" }).click();
		const dialog = page.getByRole("dialog", { name: "Supprimer le modèle" });
		await expect(dialog).toContainText("Ces éditions n'auront plus de modèle : Édition.");
		await dialog.getByRole("button", { name: "Supprimer" }).click();
		await expect(dialog).not.toBeVisible();

		await expect(page.locator(".card_item.model")).toHaveCount(0);
		await page.goto(`/reading-book/book/${bookId}`);
		await page.getByRole("button", { name: "Modifier l'édition" }).click();
		await expect(
			page.getByRole("dialog", { name: "Modifier l'édition" }).getByRole("combobox", { name: "Modèle" }),
		).toHaveValue("");
	});
});
