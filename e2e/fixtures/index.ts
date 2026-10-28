import { test as base, expect } from "@playwright/test";

// 1x1 transparent PNG
const EMPTY_TILE = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

export const test = base.extend({
	page: async ({ page }, provide) => {
		// The sport maps load their tiles from OpenStreetMap: served locally so the tests never need the network
		await page.route("https://*.tile.openstreetmap.org/**", (route) =>
			route.fulfill({ contentType: "image/png", body: EMPTY_TILE }),
		);
		await provide(page);
	},
});
export { expect };
export { resetDb, queryDb } from "../seed";

export const SEED = {
	music: {
		// 2026-10-20 (2), 2026-10-05, 2026-09-14 (2), 2026-09-02, 2026-09-01, 2025-12-10
		discovery: { id: "2771d2af-6f01-4c9e-99bf-d413896107c4", artist: "Daft Punk", album: "Discovery" },
		okComputer: { id: "6a8c2278-ef50-4d98-8aca-2f9fff03df8c", artist: "Radiohead", album: "OK Computer" },
		nevermind: { id: "413f7443-3348-45e3-9b36-137946625fad", artist: "Nirvana", album: "Nevermind" },
		cross: { id: "c58d5dc2-3a71-4c22-9105-204970fdb2c0", artist: "Justice", album: "Cross" },
		pulpFiction: {
			id: "bdc83012-75e1-4c07-b9b9-fe8fa3b8246c",
			artist: "Various Artists",
			album: "Pulp Fiction OST",
		},
		kidA: { id: "d7169845-9918-46c2-bf66-70fb665cc750", artist: "Radiohead", album: "Kid A" },
		okComputerSept: { id: "f9857d94-83d2-4215-a9e3-4bcbbe9dbb15", artist: "Radiohead", album: "OK Computer" },
		inUtero: { id: "2af7ffd0-11d5-4c94-aa07-d947e0284b33", artist: "Nirvana", album: "In Utero" },
		genres: {
			rock: { id: "71670aee-4a4a-414e-b2ab-a989ec728d72", name: "Rock" },
			electronic: { id: "41d1e519-8748-4fde-b9b2-3a86128ebbc5", name: "Electronic" },
		},
	},
	game: {
		hollow: { id: "5dfe53af-2255-4e4b-b199-317cf075130d", name: "Hollow Quest" },
		starFarm: { id: "309fa74a-15e4-4fea-8274-fe268a19e795", name: "Star Farm" },
		ruins: { id: "8b7bae29-5229-4f83-bf80-4a8d44dbb1d1", name: "Ruins" },
	},
	lifespan: {
		categories: {
			informatique: { id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01", name: "Informatique" },
			peripheriques: { id: "2d3e4f5a-6b7c-4d8e-9fa0-1b2c3d4e5f02", name: "Périphériques" },
			cuisine: { id: "3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6a03", name: "Cuisine" },
			vide: { id: "4f5a6b7c-8d9e-4fa0-b1c2-3d4e5f6a7b04", name: "Vide" },
		},
		objects: {
			// in_use
			souris: { id: "5a6b7c8d-9eaf-4b01-82c3-4d5e6f7a8b05", name: "Souris MX" },
			// ended, disposed 2025-03-01
			clavier: {
				id: "6b7c8d9e-af01-4b12-93d4-5e6f7a8b9c06",
				name: "Clavier K2",
				disposeEventId: "a1000000-0000-4000-8000-000000000006",
			},
			// paused
			laptop: { id: "7c8d9eaf-0112-4c23-a4e5-6f7a8b9cad07", name: "Laptop" },
			// not started
			cafetiere: { id: "8d9eaf01-1223-4d34-b5f6-7a8b9cadbe08", name: "Cafetière" },
		},
	},
	contextTags: {
		transport: { id: "8f2c1a3e-4b5d-4e6f-9a70-1b2c3d4e5f60", name: "Transport" },
		lieu: { id: "9a3d2b4f-5c6e-4f70-8b81-2c3d4e5f6a71", name: "Lieu" },
		ecoute: { id: "ab4e3c5a-6d7f-4081-9c92-3d4e5f6a7b82", name: "Écoute" },
	},
	sport: {
		track: { id: "a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601", name: "Fractionné piste" },
		footing: { id: "b4e2d3c5-6a7f-4081-9b02-c3d4e5f6a702", name: "Footing du dimanche" },
		swim: { id: "c5d3e4b6-7f80-4192-8c13-d4e5f6a7b803", name: "Piscine" },
		bike: { id: "d6c4f5a7-8091-42a3-9d24-e5f6a7b8c904", name: "Sortie vélo" },
		hike: { id: "e7b5a6f8-91a2-43b4-8e35-f6a7b8c9da05", name: "Randonnée Vercors" },
	},
	manga: {
		onePiece: { id: "7a6473b8-ff54-4533-ae28-ed2f592a2db7", title: "One Piece" },
		tomie: { id: "995db8eb-947f-4b68-b9c9-8cb63de01981", title: "Tomie" },
		frieren: { id: "c57490db-0444-424b-891f-35058bb8869a", title: "Frieren" },
	},
	book: {
		alice: { id: "18aff3b3-d93d-478b-969f-aa6bc521d6a4", book: "Alice’s Adventures in Wonderland" },
		littleWomen: { id: "185d86c8-d527-4213-b91c-8e52327cce8e", book: "Little Women" },
		roman: { id: "7c663c14-5404-46e6-90aa-fc76c8f052be", book: "Roman de Ronce et d'Épine" },
	},
	internet: {
		mockPodcast: { id: "982fd13b-5f14-4131-ac1a-c0575fd80f17", name: "Mock Podcast" },
		mockTube: { id: "d06eac35-d504-433f-9e1b-6b1b33206dd3", name: "Mock Tube" },
		tourDeFrance: { id: "f1d163a6-2dec-488d-97d3-c9de7ab16f49", name: "Tour de France" },
		greatShow: { id: "574153df-656c-43ff-a5ee-d497a200908d", name: "The Great Show" },
		secondPodcast: { id: "0639422a-c2f9-4bc5-97d1-bee2dc2e4753", name: "Second Podcast" },
		oldShow: { id: "5c1ea0c8-de21-485a-a517-ead72a55b8af", name: "Old Show" },
	},
	show: {
		works: {
			miserables: { id: 1, name: "Les Misérables" },
			hamlet: { id: 2, name: "Hamlet" },
		},
		spectacles: {
			miserablesParis: { id: 1, name: "Les Misérables (Paris)" },
			miserablesLondres: { id: 2, name: "Les Misérables (Londres)" },
			hamlet: { id: 3, name: "Hamlet" },
		},
		places: {
			chatelet: { id: 1, name: "Théâtre du Châtelet", formerName: "Théâtre Musical de Paris" },
			sondheim: { id: 2, name: "Sondheim Theatre" },
			comedie: { id: 3, name: "Comédie-Française" },
			empty: { id: 4, name: "Salle vide" },
		},
		artists: {
			alice: { id: 1, name: "Alice Martin" },
			bob: { id: 2, name: "Bob Smith" },
			claire: { id: 3, name: "Claire Dubois" },
		},
		// 1: 2025-03-20 Paris (cast), 2: 2025-11-08 Londres (cast), 3: 2026-02-14 Hamlet, 4: 2026-02-21 Paris canceled,
		// 5: 2026-04-10 Paris (cast), 6: 2026-09-05 Hamlet (no cast), 7: 2027-01-15 Londres (future)
		performances: {
			paris2025: 1,
			londres2025: 2,
			hamlet2026: 3,
			parisCanceled: 4,
			paris2026: 5,
			hamletSept: 6,
			future: 7,
		},
	},
	money: {
		account: { name: "Checking Account" },
		transaction: { name: "Groceries" },
	},
};
