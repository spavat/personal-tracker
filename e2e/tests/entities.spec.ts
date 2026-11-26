import type { Page } from "@playwright/test";

import { expect, queryDb, resetDb, SEED, test } from "../fixtures";

const { artists, spectacles, performances } = SEED.show;
const { alice } = SEED.book;
const { mockPodcast, secondPodcast } = SEED.broadcast;
// an episode of Mock Podcast (seed.js)
const MOCK_EPISODE_ID = "ea2929e9-9a5f-465d-8074-4e54e83a3d19";
// Served by e2e/mocks/fetch-mock.mjs
const PORTRAIT_URL = "https://images.example.com/book-cover.svg";
const SVG_PORTRAIT = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="90" fill="teal"/></svg>',
);

function entityRow(page: Page, name: string) {
	return page.locator("table.entities tbody tr").filter({ hasText: name });
}

function entityNames(page: Page) {
	return page.locator("table.entities tbody tr td:nth-child(2)");
}

test.describe("Entities - Répertoire", () => {
	test.afterEach(resetDb);

	test("list every entity as cards, then as a table", async ({ page }) => {
		await page.goto("/");
		await page.getByRole("link", { name: "Répertoire" }).click();
		await expect(page).toHaveURL("/entities");

		// cards by default: what each module credits the entity for
		await expect(page.locator(".card_item.entity").filter({ hasText: "Lewis Carroll" })).toContainText("1 livre");
		await expect(page.locator(".card_item.entity").filter({ hasText: "Pod Caster" })).toContainText("1 émission");
		// the owner also sees the entities credited nowhere yet
		await expect(page.locator(".card_item.entity").filter({ hasText: artists.claire.name })).toBeVisible();

		await page.getByLabel("Affichage").selectOption("list");
		await expect(entityRow(page, "Lewis Carroll").locator("td:not(.cell-index)")).toHaveText([
			"Lewis Carroll",
			"1",
			"0",
			"0",
			"0",
			"0",
		]);
		// the kind as an icon before the name
		await expect(entityRow(page, "Mock Radio").getByLabel("Organisation")).toBeVisible();
	});

	test("filter the list by kind, stored", async ({ page }) => {
		await page.goto("/entities");
		await page.getByLabel("Affichage").selectOption("list");
		await page.getByLabel("Type").selectOption("Organisation");
		await expect(entityRow(page, "Mock Radio")).toBeVisible();
		await expect(entityRow(page, artists.alice.name)).toHaveCount(0);
		await expect(page.locator("table.entities tbody").getByLabel("Personne")).toHaveCount(0);

		await page.reload();
		await expect(page.getByLabel("Type")).toHaveValue("organization");
		await expect(entityRow(page, artists.alice.name)).toHaveCount(0);

		await page.getByLabel("Type").selectOption("Tous");
		await expect(entityRow(page, artists.alice.name)).toBeVisible();
	});

	test("filter the list by role, stored", async ({ page }) => {
		await page.goto("/entities");
		await page.getByLabel("Affichage").selectOption("list");
		// Mock Radio: network of Mock Podcast
		await page.getByLabel("Rôle").selectOption("Réseau");
		await expect(entityRow(page, "Mock Radio")).toBeVisible();
		await expect(entityRow(page, "Pod Caster")).toHaveCount(0);

		await page.getByLabel("Rôle").selectOption("Animation");
		await expect(entityRow(page, "Pod Caster")).toBeVisible();
		await expect(entityRow(page, "Mock Radio")).toHaveCount(0);

		// a cast model or a performance
		await page.getByLabel("Rôle").selectOption("Artiste");
		await expect(entityRow(page, artists.alice.name)).toBeVisible();
		await expect(entityRow(page, "Lewis Carroll")).toHaveCount(0);

		await page.reload();
		await expect(page.getByLabel("Rôle")).toHaveValue("artist");
		await expect(entityRow(page, "Lewis Carroll")).toHaveCount(0);
	});

	test("sort the list by a count, stored", async ({ page }) => {
		await page.goto("/entities");
		await page.getByLabel("Affichage").selectOption("list");
		const header = page.getByRole("columnheader", { name: "Émissions" });
		await header.getByText("Émissions").click();
		await header.getByText("Émissions").click();
		await expect(header.locator(".fa-sort-down")).toBeVisible();
		// the most programs first: the last row has none
		const programs = page.locator("table.entities tbody tr td:nth-child(6)");
		await expect(programs.first()).not.toHaveText("0");
		const first = await entityNames(page).first().textContent();

		await page.reload();
		await expect(entityNames(page).first()).toHaveText(first!);
		await expect(header.locator(".fa-sort-down")).toBeVisible();
	});

	test("the details page shows one section per module crediting the entity", async ({ page }) => {
		// Bob plays in shows; made a guest of a Mock Podcast episode
		await queryDb(
			`INSERT INTO broadcast.episode_contributor (episode_id, entity_id, role) VALUES ($1, $2, 'guest')`,
			[MOCK_EPISODE_ID, artists.bob.id],
		);
		await page.goto("/entities");
		await page.getByRole("link", { name: artists.bob.name }).click();
		await expect(page).toHaveURL(`/entities/${artists.bob.id}`);
		await expect(page.getByRole("heading", { name: artists.bob.name })).toBeVisible();
		await expect(page.getByText("1 épisode")).toBeVisible();

		await expect(page.getByRole("heading", { name: "Représentations" })).toBeVisible();
		await expect(page.locator("table.performancesWithRole tbody tr")).not.toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Livres" })).toHaveCount(0);

		await expect(page.getByRole("heading", { name: "Émissions animées" })).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();
		const invitation = page.locator("section.broadcast table tbody tr");
		await expect(invitation).toHaveCount(1);
		await expect(invitation).toContainText(mockPodcast.name);
		await expect(invitation).toContainText("Invité·e");
		// as in the program details: its listening date and duration
		await expect(invitation).toContainText("10/10/26");
		await expect(invitation.locator("td.cell-duration")).toHaveText("40min");
		// the episode opens over its program page
		await invitation.getByRole("button", { name: "Podcast épisode 0" }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page).toHaveURL(`/broadcast/${mockPodcast.id}`);
	});

	test("an author's books and a host's programs", async ({ page }) => {
		const [{ id: carroll }] = await queryDb(`SELECT id FROM core.entity WHERE name = 'Lewis Carroll'`);
		await page.goto(`/entities/${carroll}`);
		await expect(page.getByRole("heading", { name: "Livres" })).toBeVisible();
		await expect(page.getByRole("link", { name: alice.book })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Représentations" })).toHaveCount(0);

		const [{ id: podCaster }] = await queryDb(`SELECT id FROM core.entity WHERE name = 'Pod Caster'`);
		await page.goto(`/entities/${podCaster}`);
		await expect(page.getByRole("heading", { name: "Émissions animées" })).toBeVisible();
		await page.locator("section.broadcast").getByRole("link", { name: mockPodcast.name }).click();
		await expect(page).toHaveURL(`/broadcast/${mockPodcast.id}`);
		await expect(page.getByRole("link", { name: secondPodcast.name })).toHaveCount(0);
	});

	test("every role: a network, a publisher, a translator, a cast model", async ({ page }) => {
		// Mock Radio broadcasts Mock Podcast
		const [{ id: mockRadio }] = await queryDb(`SELECT id FROM core.entity WHERE name = 'Mock Radio'`);
		await page.goto(`/entities/${mockRadio}`);
		await expect(page.getByRole("heading", { name: "Émissions diffusées" })).toBeVisible();
		await expect(page.locator("section.broadcast").getByRole("link", { name: mockPodcast.name })).toBeVisible();

		// Bob translates the edition of Alice's book, Mock Radio publishes it
		await queryDb(
			`INSERT INTO reading.edition_contributor (edition_id, entity_id, role)
			 SELECT id, $2, 'translator' FROM reading.edition WHERE book_id = $1`,
			[alice.id, artists.bob.id],
		);
		await queryDb(`UPDATE reading.edition SET publisher_id = $2 WHERE book_id = $1`, [alice.id, mockRadio]);
		await page.goto(`/entities/${mockRadio}`);
		await expect(page.getByRole("heading", { name: "Éditeur" })).toBeVisible();
		await expect(page.locator("section.reading-book").getByRole("link", { name: alice.book })).toBeVisible();
		await page.goto(`/entities/${artists.bob.id}`);
		await expect(page.getByRole("heading", { name: "Traduction" })).toBeVisible();
		await expect(page.locator("section.reading-book").getByRole("link", { name: alice.book })).toBeVisible();

		// Alice plays Fantine in a cast model
		await page.goto(`/entities/${artists.alice.id}`);
		const model = page.locator("section.shows").getByRole("row").filter({ hasText: "Distribution 2026" });
		await expect(model.locator("td")).toHaveText([spectacles.miserablesParis.name, "Distribution 2026", "Fantine"]);
	});

	test("search an entity with ctrl+shift+f", async ({ page }) => {
		await page.goto("/entities");
		await expect(page.locator(".card_item.entity").first()).toBeVisible();
		await page.keyboard.press("Control+Shift+F");
		const search = page.getByPlaceholder("Recherche");
		await expect(search).toBeFocused();
		await search.fill("caster");
		await expect(page.locator(".search .result-item")).toHaveCount(1);
		await page.keyboard.press("Enter");
		await expect(page.getByRole("heading", { name: "Pod Caster" })).toBeVisible();
		await expect(page).toHaveURL(/\/entities\/[0-9a-f-]{36}$/);
	});

	test("edit an entity from its page", async ({ page }) => {
		await page.goto(`/entities/${artists.alice.id}`);
		await page.getByRole("heading", { name: artists.alice.name }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: `Modifier ${artists.alice.name}` });
		await dialog.getByRole("textbox", { name: "Nom *" }).fill("Alice Martin-Durand");
		await dialog.getByRole("textbox", { name: "Nom de tri" }).fill("Martin-Durand, Alice");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByRole("heading", { name: "Alice Martin-Durand" })).toBeVisible();
		await expect(page.getByText("Martin-Durand, Alice")).toBeVisible();
		// the performances show the entity's new name
		await page.goto(`/shows/performances/${performances.paris2025}`);
		await expect(page.getByRole("link", { name: "Alice Martin-Durand" }).first()).toBeVisible();
	});

	test("a real name is shown on the entity page and found by the search", async ({ page }) => {
		await page.goto(`/entities/${artists.alice.id}`);
		await page.getByRole("heading", { name: artists.alice.name }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: `Modifier ${artists.alice.name}` });
		await dialog.getByRole("textbox", { name: "Nom réel" }).fill("Alicia Zwanziger");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.getByText("Nom réel : Alicia Zwanziger")).toBeVisible();

		await page.goto("/entities");
		await expect(page.locator(".card_item.entity").first()).toBeVisible();
		await page.keyboard.press("Control+Shift+F");
		await page.getByPlaceholder("Recherche").fill("zwanziger");
		await expect(page.locator(".search .result-item")).toHaveCount(1);
		await expect(page.locator(".search .result-item")).toContainText(`${artists.alice.name} (Alicia Zwanziger)`);
	});

	test("change an entity's kind: its credits are kept", async ({ page }) => {
		await page.goto(`/entities/${artists.bob.id}`);
		await page.getByRole("heading", { name: artists.bob.name }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: `Modifier ${artists.bob.name}` });
		await dialog.getByRole("combobox", { name: "Type" }).selectOption("Groupe");
		await expect(dialog).toContainText("Les informations propres à « Personne » seront perdues");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(dialog).not.toBeVisible();
		await expect(page.locator(".presentation-with-picture")).toContainText("Groupe");
		await expect(page.getByRole("heading", { name: "Représentations" })).toBeVisible();
		expect(
			await queryDb(
				`SELECT e.kind, (SELECT count(*)::int FROM core.entity_group g WHERE g.id = e.id) AS groups,
				 (SELECT count(*)::int FROM core.entity_person p WHERE p.id = e.id) AS persons
				 FROM core.entity e WHERE e.id = $1`,
				[artists.bob.id],
			),
		).toEqual([{ kind: "group", groups: 1, persons: 0 }]);
	});

	test("merge a duplicate into the main entity", async ({ page }) => {
		const [{ id: podCaster }] = await queryDb(`SELECT id FROM core.entity WHERE name = 'Pod Caster'`);
		// a duplicate: host of the same program (a credit Pod Caster already has) and guest of an episode
		const [{ id: duplicate }] = await queryDb(
			`INSERT INTO core.node (type, label) VALUES ('entity', 'P. Caster') RETURNING id`,
		);
		await queryDb(
			`INSERT INTO core.entity (id, kind, name, sort_name) VALUES ($1, 'person', 'P. Caster', 'Caster, P.')`,
			[duplicate],
		);
		await queryDb(`INSERT INTO core.entity_person (id) VALUES ($1)`, [duplicate]);
		await queryDb(
			`INSERT INTO broadcast.program_contributor (program_id, entity_id, role) VALUES ($1, $2, 'host')`,
			[mockPodcast.id, duplicate],
		);
		await queryDb(
			`INSERT INTO broadcast.episode_contributor (episode_id, entity_id, role) VALUES ($1, $2, 'guest')`,
			[MOCK_EPISODE_ID, duplicate],
		);

		await page.goto("/entities");
		await page.getByRole("link", { name: "Fusionner" }).click();
		await expect(page).toHaveURL("/entities/merge");
		await page.getByLabel("Filtrer : Entité principale").fill("pod caster");
		await page.getByLabel("Entité principale", { exact: true }).selectOption(podCaster);
		await page.getByLabel("Filtrer : Entité secondaire").fill("p. caster");
		await page.getByLabel("Entité secondaire", { exact: true }).selectOption(duplicate);

		await expect(page.locator(".merge")).toContainText("Il prend son nom de tri : Caster, P.");
		await expect(page.locator(".merge")).toContainText("P. Caster est supprimé");
		await page.getByRole("button", { name: "Fusionner" }).click();

		await expect(page).toHaveURL(`/entities/${podCaster}`);
		await expect(page.getByRole("heading", { name: "Pod Caster" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Invitations" })).toBeVisible();
		expect(await queryDb(`SELECT count(*)::int AS n FROM core.node WHERE id = $1`, [duplicate])).toEqual([
			{ n: 0 },
		]);
		// the host credit is not doubled, the guest credit moved
		expect(
			await queryDb(
				`SELECT role, count(*)::int AS n FROM broadcast.program_contributor WHERE program_id = $1 GROUP BY role`,
				[mockPodcast.id],
			),
		).toContainEqual({ role: "host", n: 1 });
		expect(
			await queryDb(
				`SELECT entity_id FROM broadcast.episode_contributor WHERE episode_id = $1 AND role = 'guest'`,
				[MOCK_EPISODE_ID],
			),
		).toEqual([{ entity_id: podCaster }]);
		expect(await queryDb(`SELECT sort_name FROM core.entity WHERE id = $1`, [podCaster])).toEqual([
			{ sort_name: "Caster, P." },
		]);
	});
});

// Lewis Carroll: the author of Alice's book
async function openCarroll(page: Page) {
	const [{ id }] = await queryDb(`SELECT id FROM core.entity WHERE name = 'Lewis Carroll'`);
	await page.goto(`/entities/${id}`);
	await expect(page.getByRole("heading", { name: "Lewis Carroll" })).toBeVisible();
}

async function openEditModal(page: Page) {
	await page.locator(".presentation-with-picture").getByRole("button", { name: "Modifier" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	return dialog;
}

test.describe("Entities - links and portrait", () => {
	test.afterEach(resetDb);

	test("an author in the book list links to their entity page", async ({ page }) => {
		await page.goto("/reading-book/list");
		const row = page.locator("table.books tbody tr").filter({ hasText: alice.book });
		await row.getByRole("link", { name: "Lewis Carroll" }).click();
		await expect(page).toHaveURL(/\/entities\/[0-9a-f-]{36}$/);
		await expect(page.getByRole("heading", { name: "Lewis Carroll" })).toBeVisible();
	});

	test("an author credited under another name on the book page links to their entity page", async ({ page }) => {
		await page.goto(`/reading-book/book/${alice.id}`);
		await page.getByRole("heading", { name: alice.book }).getByRole("button", { name: "Modifier" }).click();
		const dialog = page.getByRole("dialog", { name: "Modifier le livre" });
		await dialog.getByRole("textbox", { name: "Auteur·ice 1 crédité·e comme" }).fill("L. Carroll");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog).not.toBeVisible();

		// the book shows the credited name, the entity keeps its own
		await expect(page.locator(".details .general")).toContainText("Auteur.ic.es: L. Carroll");
		await page.locator(".details .general").getByRole("link", { name: "L. Carroll" }).click();
		await expect(page).toHaveURL(/\/entities\/[0-9a-f-]{36}$/);
		await expect(page.getByRole("heading", { name: "Lewis Carroll" })).toBeVisible();
	});

	test("an artist of a performance links to their entity page", async ({ page }) => {
		await page.goto(`/shows/performances/${performances.paris2025}`);
		await page.getByRole("link", { name: artists.bob.name }).first().click();
		await expect(page).toHaveURL(`/entities/${artists.bob.id}`);
		await expect(page.getByRole("heading", { name: "Représentations" })).toBeVisible();
	});

	test("the name is required", async ({ page }) => {
		await openCarroll(page);
		const dialog = await openEditModal(page);
		await dialog.getByRole("textbox", { name: "Nom *" }).fill(" ");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		await expect(dialog.getByText("Le nom est obligatoire")).toBeVisible();
	});

	test("add a portrait from a URL, then remove it", async ({ page }) => {
		await openCarroll(page);
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
		await openCarroll(page);
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
		await openCarroll(page);
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
