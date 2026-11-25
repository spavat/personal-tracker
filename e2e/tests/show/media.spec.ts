import type { Locator, Page } from "@playwright/test";

import { expect, queryDb, resetDb, SEED, test } from "../../fixtures";

const { spectacles, performances } = SEED.show;

// 2x3 red PNG: big enough for sharp, small enough to inline
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4z8DwnwGMERQARNAF+661WskAAAAASUVORK5CYII=",
	"base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");

function gallery(page: Page) {
	return page.locator(".media-gallery figure");
}

async function upload(
	page: Page,
	file: { name: string; mimeType: string; buffer: Buffer },
	label: string,
	kind?: string,
) {
	const form = page.locator(".media-upload");
	await form.locator('input[type="file"]').setInputFiles(file);
	await form.getByPlaceholder("Libellé (Saison 2…)").fill(label);
	if (kind) {
		await form.locator("select").selectOption({ label: kind });
	}
	await form.getByRole("button", { name: "Ajouter" }).click();
	await expect(gallery(page).filter({ hasText: label })).toHaveCount(1);
}

async function expectImageLoaded(img: Locator) {
	await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
}

test.describe("Shows - Media", () => {
	test.afterEach(resetDb);

	test("spectacle posters: upload, pick for a performance, delete", async ({ page }) => {
		await page.goto(`/shows/spectacles/${spectacles.miserablesParis.id}`);
		await upload(page, { name: "s1.png", mimeType: "image/png", buffer: PNG }, "Saison 1");
		await upload(page, { name: "s2.png", mimeType: "image/png", buffer: PNG }, "Saison 2");
		await upload(
			page,
			{ name: "prog.pdf", mimeType: "application/pdf", buffer: PDF },
			"Programme 2025",
			"Programme",
		);

		await expect(gallery(page)).toHaveCount(3);
		// uploads are appended; the order is kept after a reload
		const labels = gallery(page).locator("figcaption");
		await expect(labels).toHaveText([/Saison 1/, /Saison 2/, /Programme 2025/]);
		await gallery(page).first().getByTitle("Déplacer après").click();
		await expect(labels).toHaveText([/Saison 2/, /Saison 1/, /Programme 2025/]);
		await page.reload();
		await expect(labels).toHaveText([/Saison 2/, /Saison 1/, /Programme 2025/]);
		await expect(gallery(page).first().getByTitle("Déplacer avant")).toBeDisabled();
		await expectImageLoaded(gallery(page).first().locator("img"));
		// the PDF is stored as-is, the images as AVIF
		const pdfLink = gallery(page).filter({ hasText: "Programme 2025" }).locator("a");
		const pdf = await page.request.get(await pdfLink.getAttribute("href").then((href) => href!));
		expect(pdf.headers()["content-type"]).toBe("application/pdf");
		const posterSrc = await gallery(page).filter({ hasText: "Saison 1" }).locator("img").getAttribute("src");
		const poster = await page.request.get(posterSrc!);
		expect(poster.headers()["content-type"]).toBe("image/avif");
		// stored under the app prefix, keyed by the uuid
		const keys = (await queryDb("SELECT id, key FROM show.media ORDER BY key")).map((row) =>
			row.key.replace(row.id, "<id>"),
		);
		expect(keys.toSorted()).toEqual([
			"personal-tracker/show/media/<id>.avif",
			"personal-tracker/show/media/<id>.avif",
			"personal-tracker/show/media/<id>.pdf",
		]);

		// the performance poster picker only offers the posters
		await page.goto(`/shows/performances/${performances.paris2025}`);
		await page.locator(".presentation-with-picture .title").getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier la représentation" });
		const picker = dialog.locator(".media-picker");
		await expect(picker.locator("img")).toHaveCount(2);
		await picker.getByTitle("Saison 2").click();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();
		await expectImageLoaded(page.locator(".presentation-with-picture img.poster"));

		await page.goto("/shows/performances");
		await expect(page.locator("table.performances img.poster-thumb")).toHaveCount(1);

		// a poster in use cannot be deleted, an unused one can
		await page.goto(`/shows/spectacles/${spectacles.miserablesParis.id}`);
		page.on("dialog", (d) => d.accept());
		await gallery(page).filter({ hasText: "Saison 2" }).getByTitle("Supprimer").click();
		await expect(page.getByText("Média utilisé")).toBeVisible();
		await gallery(page).filter({ hasText: "Saison 1" }).getByTitle("Supprimer").click();
		await expect(gallery(page)).toHaveCount(2);
	});
});
