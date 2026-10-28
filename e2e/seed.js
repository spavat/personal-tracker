// Seed data shared by setup-db.js (once, before the run) and resetDb (after mutating tests).
const { Client } = require("pg");
const { MongoClient } = require("mongodb");

const { TEST_DB, MONGO_SERVER_URL, TEST_POSTGRES_URL } = require("./db-config");

/** @param {import("pg").Client} conn */
async function seedPostgres(conn) {
	await conn.query(
		`INSERT INTO money.bank (id, name)
		 VALUES (1, 'Main Bank'), (2, 'Secondary Bank'), (3, 'General')`,
	);
	await conn.query(
		`INSERT INTO money.account (id, name, icon, text_color, background_color, bank_id)
		 VALUES
		 (1, 'Checking Account', 'fa-solid fa-money-check', '#d20073', '#d20073', 1),
		 (2, 'Livret A', 'fa-solid fa-piggy-bank', '#d20073', '#d20073', 1),
		 (3, 'Checking Account', 'fa-solid fa-money-check', '#0bbaf4', '#0bbaf4', 2),
		 (4, 'Cash', 'fa-solid fa-coins', '#096a09', '#096a09', 3)`,
	);
	await conn.query(
		`INSERT INTO money.account_history (id, account_id, date, amount)
		 VALUES
		 	(1, 1, '2025-01-01', 0),
			(2, 2, '2025-01-01', 5000),
			(3, 3, '2025-01-01', 600),
			(4, 4, '2025-01-01', 30)`,
	);
	await conn.query(
		`INSERT INTO money.category (id, name, icon, text_color, background_color, parent_id)
		 VALUES (1, 'Food', 'fas fa-utensils', '#3e3e3e', '#39d006', NULL),
		 (2, 'Health', 'fas fa-medkit', '#ffffff', '#ff0000', NULL),
		 (3, 'Transport', 'fas fa-bus', '#000000', '#c0bfbc', NULL),
		 (4, 'Hobbies', 'fas fa-gamepad', '#ffffff', '#1c71d8', NULL),
		 (5, 'Hobbies > Music', 'fas fa-music', '#ffffff', '#1c71d8', 4),
		 (6, 'Hobbies > Book', 'fas fa-book', '#ffffff', '#1c71d8', 4)`,
	);
	await conn.query(
		`INSERT INTO money.payment_type (id, name, icon, text_color, background_color, account_id)
		 VALUES (1, 'Card Main Bank', 'far fa-credit-card', '#fff', '#9c27b0', 1),
		 (2, 'Livret A', 'far fa-credit-card', '#fff', '#9c27b0', 2),
		 (3, 'Card Secondary Bank', 'far fa-credit-card', '#000', '#0bbaf4', 3),
		 (4, 'Cash', 'far fa-credit-card', '#fff', '#008000', 4)`,
	);
	await conn.query(
		`INSERT INTO money.transaction (id, name, date, consideration_date, amount, category_id, payment_type_id, parent_id)
		 VALUES
		 (1, 'Groceries', '2026-06-01', '2026-06-01', -45.50, 1, 1, NULL),
		 (2, 'Doctor', '2026-06-05', '2026-06-05', -30, 2, 1, NULL),
		 (3, 'Auchan', '2026-06-10', '2026-06-10', -30, NULL, NULL, NULL),
		 (4, 'Groceries', '2026-06-10', '2026-06-10', -10, 1, 1, 3),
		 (5, 'Health', '2026-06-10', '2026-06-10', -20, 2, 1, 3),
		 (6, 'Restaurant', '2025-03-15', '2025-03-15', -25, 1, 1, NULL),
		 (7, 'Bar', '2025-07-20', '2025-07-20', -12, 1, 1, NULL),
		 (8, 'Steam', '2026-04-05', '2026-04-05', -69, 4, 4, NULL),
		 (9, 'Bandcamp', '2026-04-12', '2026-04-12', -20, 5, 4, NULL),
		 (10, 'Kindle', '2026-04-20', '2026-04-20', -6.99, 6, 4, NULL)`,
	);
	// Analytics group tags by the part before the backslash ("Food")
	await conn.query(
		`INSERT INTO money.tag (id, name, icon, text_color, background_color)
		 VALUES (1, $1, 'fas fa-cookie-bite', '#000000', '#f6d32d'),
		 (2, $2, 'fas fa-wine-glass', '#ffffff', '#813d9c')`,
		["Food\\Miam", "Food\\Drink"],
	);
	await conn.query(
		`INSERT INTO money.transaction_tag (transaction_id, tag_id)
		 VALUES (1, 1), (4, 1), (6, 1), (7, 2)`,
	);
	await conn.query(`INSERT INTO show.work (id, name) VALUES (1, 'Les Misérables'), (2, 'Hamlet')`);
	await conn.query(
		`INSERT INTO show.spectacle (id, name, work_id)
		 VALUES (1, 'Les Misérables (Paris)', 1), (2, 'Les Misérables (Londres)', 1), (3, 'Hamlet', 2)`,
	);
	await conn.query(
		`INSERT INTO show.place (id, name, address, country, link)
		 VALUES (1, 'Théâtre du Châtelet', '1 place du Châtelet, Paris', 'fr', 'https://www.chatelet.com'),
		 (2, 'Sondheim Theatre', '51 Shaftesbury Avenue, London', 'gb', NULL),
		 (3, 'Comédie-Française', '1 place Colette, Paris', 'fr', NULL),
		 (4, 'Salle vide', '', 'fr', NULL)`,
	);
	// Performance 1 is before the rename: listed with the former name
	await conn.query(
		`INSERT INTO show.place_former_name (place_id, name, until_date) VALUES (1, 'Théâtre Musical de Paris', '2025-06-01')`,
	);
	await conn.query(
		`INSERT INTO show.performance (id, date, place_id, spectacle_id, canceled, seat, casting_status, casting_origin)
		 VALUES (1, '2025-03-20 20:00:00', 1, 1, false, 'B7', 'complete', 'program'),
		 (2, '2025-11-08 19:30:00', 2, 2, false, 'D12', 'partial', 'performance'),
		 (3, '2026-02-14 20:00:00', 3, 3, false, '', 'unknown', 'na'),
		 (4, '2026-02-21 20:00:00', 1, 1, true, 'A12', 'tbd', 'na'),
		 (5, '2026-04-10 20:30:00', 1, 1, false, 'C3', 'complete', 'performance'),
		 (6, '2026-09-05 15:00:00', 3, 3, false, 'F1', 'tbd', 'na'),
		 (7, '2027-01-15 20:00:00', 2, 2, false, 'E5', 'tbd', 'na')`,
	);
	await conn.query(
		`INSERT INTO show.artist (id, name) VALUES (1, 'Alice Martin'), (2, 'Bob Smith'), (3, 'Claire Dubois')`,
	);
	await conn.query(
		`INSERT INTO show.role (artist_id, performance_id, name, status, main, "order")
		 VALUES (1, 1, 'Fantine', NULL, true, 1), (2, 1, 'Javert', NULL, false, 2),
		 (2, 2, 'Javert', 'doublure', false, 1),
		 (1, 5, 'Fantine', NULL, true, 1)`,
	);
	await conn.query(`INSERT INTO show.model (id, name, spectacle_id) VALUES (1, 'Distribution 2026', 1)`);
	await conn.query(
		`INSERT INTO show.model_role (name, main, artist_id, model_id, "order")
		 VALUES ('Fantine', true, 1, 1, 1), ('Javert', false, NULL, 1, 2)`,
	);

	// Explicit ids don't move identity sequences (unlike MySQL AUTO_INCREMENT): restart them after the seed
	await conn.query(`
		DO $$
		DECLARE r record;
		BEGIN
			FOR r IN SELECT table_schema, table_name, column_name FROM information_schema.columns
					 WHERE table_schema IN ('money', 'show') AND is_identity = 'YES' LOOP
				EXECUTE format('SELECT setval(pg_get_serial_sequence(%L, %L), coalesce(max(%I), 0) + 1, false) FROM %I.%I',
					format('%I.%I', r.table_schema, r.table_name), r.column_name, r.column_name, r.table_schema, r.table_name);
			END LOOP;
		END $$`);
}

// 25 points, 100 m north and 30 s apart (5:00 /km), climbing 1 m each: 2.4 km in 12 min
function buildTrackPoints() {
	const start = Date.parse("2026-10-20T17:00:00Z");
	return Array.from({ length: 25 }, (_, i) => ({
		id: `pt-${i}`,
		lat: 45 + i * 0.0009,
		lon: 5.7,
		ele: 200 + i,
		time: new Date(start + i * 30_000).toISOString(),
		distanceFromStart: i * 100,
		...(i > 0 ? { pace: 300 } : {}),
	}));
}

/** @param {import("mongodb").Db} db */
async function seedMongo(db) {
	await db.collection("music_listening").insertMany([
		{
			id: "2771d2af-6f01-4c9e-99bf-d413896107c4",
			listeningDate: "2026-10-20",
			artist: ["Daft Punk"],
			album: "Discovery",
			releaseDate: "2001-03-12",
			duration: 61,
			genre: "Electro",
			created: "2026-10-20T21:00:00",
		},
		{
			id: "6a8c2278-ef50-4d98-8aca-2f9fff03df8c",
			listeningDate: "2026-10-20",
			artist: ["Radiohead"],
			album: "OK Computer",
			releaseDate: "1997",
			duration: 53,
			genre: "Rock",
			contextTags: ["train"],
			created: "2026-10-20T08:00:00",
		},
		{
			id: "413f7443-3348-45e3-9b36-137946625fad",
			listeningDate: "2026-10-05",
			artist: ["Nirvana"],
			album: "Nevermind",
			releaseDate: "1991",
			duration: 49,
			genre: "Grunge",
			created: "2026-10-05T10:00:00",
		},
		{
			id: "c58d5dc2-3a71-4c22-9105-204970fdb2c0",
			listeningDate: "2026-09-14",
			artist: ["Justice", "Mehdi"],
			album: "Cross",
			releaseDate: "2007",
			duration: 48,
			genre: "Techno",
			created: "2026-09-14T20:00:00",
		},
		{
			id: "bdc83012-75e1-4c07-b9b9-fe8fa3b8246c",
			listeningDate: "2026-09-14",
			artist: ["Various Artists"],
			album: "Pulp Fiction OST",
			releaseDate: "1994",
			duration: 41,
			genre: "Soundtrack",
			compilation: true,
			created: "2026-09-14T10:00:00",
		},
		{
			id: "d7169845-9918-46c2-bf66-70fb665cc750",
			listeningDate: "2026-09-02",
			artist: ["Radiohead"],
			album: "Kid A",
			releaseDate: "2000",
			duration: 50,
			genre: "Rock",
			created: "2026-09-02T10:00:00",
		},
		{
			id: "f9857d94-83d2-4215-a9e3-4bcbbe9dbb15",
			listeningDate: "2026-09-01",
			artist: ["Radiohead"],
			album: "OK Computer",
			releaseDate: "1997",
			duration: 53,
			genre: "Rock",
			created: "2026-09-01T10:00:00",
		},
		{
			id: "2af7ffd0-11d5-4c94-aa07-d947e0284b33",
			listeningDate: "2025-12-10",
			artist: ["Nirvana"],
			album: "In Utero",
			releaseDate: "",
			duration: 41,
			genre: "Grunge",
			created: "2025-12-10T10:00:00",
		},
	]);
	await db.collection("music_genre").insertMany([
		{ id: "71670aee-4a4a-414e-b2ab-a989ec728d72", name: "Rock", genres: ["Rock", "Grunge", "Hard Rock"] },
		{ id: "41d1e519-8748-4fde-b9b2-3a86128ebbc5", name: "Electronic", genres: ["Electro", "Techno"] },
	]);

	await db.collection("game").insertMany([
		{
			id: "5dfe53af-2255-4e4b-b199-317cf075130d",
			name: "Hollow Quest",
			developper: "Cherry Team",
			editor: "Cherry Publishing",
			complete: true,
			links: [{ name: "Steam", link: "https://store.steampowered.com/app/1001/" }],
			plays: [
				{
					id: "5e5c6012-5208-47a8-a873-d1a90d3892f3",
					date: "2025-12-20",
					duration: 120,
					created: "2025-12-20T20:00:00",
				},
				{
					id: "6468f840-249b-4134-bef5-ca37340866be",
					date: "2026-02-03",
					duration: 90,
					comment: "Boss final",
					created: "2026-02-03T20:00:00",
				},
				{
					id: "f9593ea1-994b-474d-b6e4-06c3a6c1ae1e",
					date: "2026-08-15",
					duration: 45,
					created: "2026-08-15T20:00:00",
				},
			],
		},
		{
			id: "309fa74a-15e4-4fea-8274-fe268a19e795",
			name: "Star Farm",
			developper: "Solo Dev",
			editor: "Solo Dev",
			plays: [{ id: "20231a72-fbe7-41c0-b418-883c4b118aa5", date: "2026-05-01", created: "2026-05-01T20:00:00" }],
		},
		{
			id: "8b7bae29-5229-4f83-bf80-4a8d44dbb1d1",
			name: "Ruins",
			developper: "Indie",
			editor: "Indie Publishing",
			plays: [
				{
					id: "85aae0ba-03ed-4f9a-b804-dbacc21ecc99",
					date: "2025-07-07",
					duration: 60,
					created: "2025-07-07T20:00:00",
				},
			],
		},
	]);

	// Out of name order
	await db.collection("lifespan_category").insertMany([
		{ id: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01", name: "Informatique", parentId: null },
		{
			id: "2d3e4f5a-6b7c-4d8e-9fa0-1b2c3d4e5f02",
			name: "Périphériques",
			parentId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01",
		},
		{ id: "3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6a03", name: "Cuisine", parentId: null },
		{ id: "4f5a6b7c-8d9e-4fa0-b1c2-3d4e5f6a7b04", name: "Vide", parentId: null },
	]);
	await db.collection("lifespan_object").insertMany([
		{
			id: "5a6b7c8d-9eaf-4b01-82c3-4d5e6f7a8b05",
			name: "Souris MX",
			type: "souris",
			categoryId: "2d3e4f5a-6b7c-4d8e-9fa0-1b2c3d4e5f02",
			events: [
				{
					id: "a1000000-0000-4000-8000-000000000001",
					type: "bought",
					date: "2023-02-01",
					created: "2023-02-01T12:00:00",
				},
				{
					id: "a1000000-0000-4000-8000-000000000002",
					type: "start_usage",
					date: "2023-02-05",
					created: "2023-02-05T12:00:00",
				},
			],
		},
		{
			id: "6b7c8d9e-af01-4b12-93d4-5e6f7a8b9c06",
			name: "Clavier K2",
			type: "clavier",
			categoryId: "2d3e4f5a-6b7c-4d8e-9fa0-1b2c3d4e5f02",
			events: [
				{
					id: "a1000000-0000-4000-8000-000000000003",
					type: "bought",
					date: "2022-06-01",
					created: "2022-06-01T12:00:00",
				},
				{
					id: "a1000000-0000-4000-8000-000000000004",
					type: "start_usage",
					date: "2022-06-02",
					created: "2022-06-02T12:00:00",
				},
				{
					id: "a1000000-0000-4000-8000-000000000005",
					type: "end_usage",
					date: "2025-01-10",
					created: "2025-01-10T12:00:00",
				},
				{
					id: "a1000000-0000-4000-8000-000000000006",
					type: "dispose",
					date: "2025-03-01",
					cause: "given_away",
					comment: "Donné à Paul",
					created: "2025-03-01T12:00:00",
				},
			],
		},
		{
			id: "7c8d9eaf-0112-4c23-a4e5-6f7a8b9cad07",
			name: "Laptop",
			description: "Portable perso",
			categoryId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01",
			events: [
				{
					id: "a1000000-0000-4000-8000-000000000007",
					type: "received",
					date: "2024-09-01",
					created: "2024-09-01T12:00:00",
				},
				{
					id: "a1000000-0000-4000-8000-000000000008",
					type: "start_usage",
					date: "2024-09-02",
					created: "2024-09-02T12:00:00",
				},
				{
					id: "a1000000-0000-4000-8000-000000000009",
					type: "pause_usage",
					date: "2026-05-01",
					created: "2026-05-01T12:00:00",
				},
			],
		},
		{
			id: "8d9eaf01-1223-4d34-b5f6-7a8b9cadbe08",
			name: "Cafetière",
			categoryId: "3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6a03",
			events: [
				{
					id: "a1000000-0000-4000-8000-000000000010",
					type: "bought",
					date: "2026-10-01",
					created: "2026-10-01T12:00:00",
				},
			],
		},
	]);

	await db.collection("context_tags").insertMany([
		{ id: "8f2c1a3e-4b5d-4e6f-9a70-1b2c3d4e5f60", name: "Transport", tags: ["train", "voiture", "vélo"] },
		{ id: "9a3d2b4f-5c6e-4f70-8b81-2c3d4e5f6a71", name: "Lieu", tags: ["maison", "bureau"] },
		{ id: "ab4e3c5a-6d7f-4081-9c92-3d4e5f6a7b82", name: "Écoute", tags: ["casque"] },
	]);

	await db.collection("sport").insertMany([
		{
			id: "a3f1c2d4-5b6e-4f70-8a91-b2c3d4e5f601",
			name: "Fractionné piste",
			type: "running",
			date: "2026-10-20T19:00:00",
			created: "2026-10-20T20:00:00",
			details: {
				movingDuration: 12,
				totalDuration: 12,
				distance: 2.4,
				pace: 5,
				elevationGain: 24,
				elevationLoss: 0,
			},
			points: buildTrackPoints(),
			segments: [
				{ time: 0, type: "running", label: "Échauffement" },
				{ time: 300, type: "pause" },
				{ time: 360, type: "running", label: "Segment #2" },
			],
		},
		{
			id: "b4e2d3c5-6a7f-4081-9b02-c3d4e5f6a702",
			name: "Footing du dimanche",
			type: "running",
			date: "2026-10-11T09:30:00",
			created: "2026-10-11T12:00:00",
			details: {
				movingDuration: 50,
				totalDuration: 55,
				distance: 10.2,
				pace: 5.39,
				elevationGain: 85,
				elevationLoss: 80,
			},
			comment: "Bonnes sensations",
		},
		{
			id: "c5d3e4b6-7f80-4192-8c13-d4e5f6a7b803",
			name: "Piscine",
			type: "swimming",
			date: "2026-10-05T18:00:00",
			created: "2026-10-05T20:00:00",
			details: { movingDuration: 30, totalDuration: 35, distance: 1.5, pace: 23.33 },
		},
		{
			// Last day of the month
			id: "d6c4f5a7-8091-42a3-9d24-e5f6a7b8c904",
			name: "Sortie vélo",
			type: "cycling",
			date: "2026-09-30T10:00:00",
			created: "2026-09-30T14:00:00",
			details: {
				movingDuration: 120,
				totalDuration: 135,
				distance: 52.4,
				pace: 2.58,
				elevationGain: 640,
				elevationLoss: 650,
			},
		},
		{
			// Strava import type, not in the form's select
			id: "e7b5a6f8-91a2-43b4-8e35-f6a7b8c9da05",
			name: "Randonnée Vercors",
			type: "hiking",
			date: "2026-08-14T08:00:00",
			created: "2026-08-14T20:00:00",
			details: {
				movingDuration: 280,
				totalDuration: 330,
				distance: 14.8,
				pace: 22.3,
				elevationGain: 900,
				elevationLoss: 900,
			},
		},
	]);

	await db.collection("reading_manga").insertMany([
		{
			id: "7a6473b8-ff54-4533-ae28-ed2f592a2db7",
			title: "One Piece",
			author: ["Eiichirô ODA"],
			type: "Shonen",
			status: "in-progress",
			readings: [
				{
					id: "3b899ee1-bbc4-4472-b92a-3a58a7ada5f2",
					name: "01",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2026-05-10",
					created: "2026-05-10T10:00:00",
				},
				{
					id: "ff5655fe-ea34-496f-9863-8219517f722e",
					name: "02",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2026-05-10",
					created: "2026-05-10T11:00:00",
				},
				{
					id: "f4409dde-9037-4ddc-b348-8455fbe52275",
					name: "03",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2026-05-10",
					created: "2026-05-10T12:00:00",
				},
				{
					id: "a91cd5ea-09b5-4e68-92e5-f2dfff3d129b",
					name: "04",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2026-05-11",
					created: "2026-05-11T10:00:00",
				},
				{
					id: "5d7fb2ee-4aa6-4240-91dc-44271f9a1a83",
					name: "05",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2026-05-11",
					created: "2026-05-11T11:00:00",
				},
				{
					id: "6ae521ac-6119-455b-8d01-b06096682ecc",
					name: "06",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2026-05-12",
					created: "2026-05-12T10:00:00",
				},
			],
		},
		{
			id: "995db8eb-947f-4b68-b9c9-8cb63de01981",
			title: "Tomie",
			author: ["Junji ITÔ"],
			type: "Seinen",
			status: "complete",
			readings: [
				{
					id: "40f9055b-6224-46a1-b6e8-c1c482bba31b",
					name: "01",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2025-01-01",
					created: "2025-01-01T10:00:00",
				},
				{
					id: "6210f687-fa71-4e33-ae35-a01c32b4309d",
					name: "02",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2025-01-01",
					created: "2025-01-01T10:00:01",
				},
				{
					id: "5ce9c3a9-9073-4cc0-bfab-b46f6dcb9a3c",
					name: "03",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2025-01-01",
					created: "2025-01-01T10:00:02",
				},
			],
		},
		{
			id: "c57490db-0444-424b-891f-35058bb8869a",
			title: "Frieren",
			art: ["Tsukasa ABE"],
			scenario: ["Kanehito YAMADA"],
			type: "Shonen",
			genres: ["aventure", "fantastique"],
			status: "in-progress",
			readings: [
				{
					id: "00be65b5-07c2-4763-abdf-3c5abb91f7ae",
					name: "01",
					language: "fr",
					origin: "Digital",
					type: "volume",
					date: "2026-10-25",
					created: "2026-10-25T20:00:00",
				},
			],
		},
	]);

	await db.collection("reading_book").insertMany([
		{
			id: "18aff3b3-d93d-478b-969f-aa6bc521d6a4",
			book: "Alice’s Adventures in Wonderland",
			author: ["Lewis Carroll"],
			language: "en",
			country: "gb",
			pages: 181,
			readings: [
				{
					id: "0883b913-75f8-4cf2-83b2-a9b832a9311e",
					status: "complete",
					details: [
						{
							id: "5f1f45c9-e632-4c65-9052-0547f8c909d1",
							context: [
								{
									date: "2026-02-05",
									tags: ["metro"],
								},
							],
						},
						{
							id: "bd641031-6c6c-4092-aaa9-65cf1a3a3028",
							context: [
								{
									date: "2026-02-05",
									tags: ["metro"],
								},
							],
						},
						{
							id: "918bd7c0-8540-41ff-8cbb-2af446d4e0e8",
							context: [
								{
									date: "2026-02-05",
									tags: ["metro"],
								},
							],
						},
						{
							id: "e0e42b01-623d-4322-aaeb-414a9fcbb857",
							context: [
								{
									date: "2026-02-05",
									tags: ["metro"],
								},
							],
						},
						{
							id: "e5b36443-d3f4-4518-8071-13188c760b31",
							context: [
								{
									date: "2026-02-17",
									tags: ["metro"],
								},
							],
						},
						{
							id: "1cc850e6-ed33-42f8-a19b-2ef14ce7ecda",
							context: [
								{
									date: "2026-02-17",
									tags: ["metro"],
								},
							],
						},
						{
							id: "ade3c2e2-bce5-402d-86a7-9e9246107948",
							context: [
								{
									date: "2026-02-19",
									tags: ["metro"],
								},
							],
						},
						{
							id: "214fd9e9-7417-4954-a7bf-002068607722",
							context: [
								{
									date: "2026-02-21",
									tags: ["metro"],
								},
							],
						},
						{
							id: "e9bbd2b1-9e70-438c-acb8-c4311635e6bd",
							context: [
								{
									date: "2026-03-08",
									tags: ["metro"],
								},
							],
						},
						{
							id: "5dcb9969-7bea-4104-993b-f6763dff5bf1",
							context: [
								{
									date: "2026-03-08",
									tags: ["metro"],
								},
							],
						},
						{
							id: "bcca2ae5-a8f9-46f0-9783-373bf0878dd5",
							context: [
								{
									date: "2026-03-08",
									tags: ["metro"],
								},
							],
						},
						{
							id: "18c7e3b8-1620-4942-9236-1e6c74fe28ed",
							context: [
								{
									date: "2026-03-08",
									tags: ["metro"],
								},
							],
						},
					],
				},
			],
			model: [
				{
					id: "5f1f45c9-e632-4c65-9052-0547f8c909d1",
					title: "I: Down the Rabbit-Hole",
				},
				{
					id: "bd641031-6c6c-4092-aaa9-65cf1a3a3028",
					title: "II: The Pool of Tears",
				},
				{
					id: "918bd7c0-8540-41ff-8cbb-2af446d4e0e8",
					title: "III: A Caucus-Race and a Long Tale",
				},
				{
					id: "e0e42b01-623d-4322-aaeb-414a9fcbb857",
					title: "IV: The Rabbit Sends in a Little Bill",
				},
				{
					id: "e5b36443-d3f4-4518-8071-13188c760b31",
					title: "V: Advice from a Caterpillar",
				},
				{
					id: "1cc850e6-ed33-42f8-a19b-2ef14ce7ecda",
					title: "VI: Pig and Pepper",
				},
				{
					id: "ade3c2e2-bce5-402d-86a7-9e9246107948",
					title: "VII: A Mad Tea-Party",
				},
				{
					id: "214fd9e9-7417-4954-a7bf-002068607722",
					title: "VIII: The Queen’s Croquet-Ground",
				},
				{
					id: "e9bbd2b1-9e70-438c-acb8-c4311635e6bd",
					title: "IX: The Mock Turtle’s Story",
				},
				{
					id: "5dcb9969-7bea-4104-993b-f6763dff5bf1",
					title: "X: The Lobster Quadrille",
				},
				{
					id: "bcca2ae5-a8f9-46f0-9783-373bf0878dd5",
					title: "XI: Who Stole the Tarts?",
				},
				{
					id: "18c7e3b8-1620-4942-9236-1e6c74fe28ed",
					title: "XII: Alice’s Evidence",
				},
			],
		},
		{
			id: "185d86c8-d527-4213-b91c-8e52327cce8e",
			book: "Little Women",
			author: ["Louisa May Alcott"],
			language: "en",
			country: "us",
			pages: 495,
			readings: [
				{
					id: "ca8ac288-e15c-4b4d-a86c-68ea69dc70f5",
					status: "abandoned",
					details: [
						{
							id: "ecaa30ab-253f-452b-85dd-d227622a6784",
							context: [
								{
									date: "2026-09-02",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "191b9ae2-8aec-4433-9878-cb804a73ca11",
							context: [
								{
									date: "2026-09-02",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "cee92420-e6ec-4bba-bed6-009cb1dffe1c",
							context: [
								{
									date: "2026-09-22",
									tags: ["metro"],
								},
							],
						},
						{
							id: "d4fd5f11-d377-4fb4-b138-39fa6ade8f40",
							context: [
								{
									date: "2026-09-22",
									tags: ["metro", "bus"],
								},
							],
						},
						{
							id: "4365e37e-0b8f-41d6-adbc-8a35d11c53a8",
							context: [
								{
									date: "2026-09-22",
									tags: ["metro"],
								},
							],
						},
					],
				},
			],
			model: [
				{
					id: "6af2a135-554c-4b15-b4e8-b7b65bc7cfc1",
					title: "Part I",
					content: [
						{
							id: "ecaa30ab-253f-452b-85dd-d227622a6784",
							title: "I: Playing Pilgrims",
						},
						{
							id: "191b9ae2-8aec-4433-9878-cb804a73ca11",
							title: "II: A Merry Christmas",
						},
						{
							id: "cee92420-e6ec-4bba-bed6-009cb1dffe1c",
							title: "III: The Laurence Boy",
						},
						{
							id: "d4fd5f11-d377-4fb4-b138-39fa6ade8f40",
							title: "IV: Burdens",
						},
						{
							id: "4365e37e-0b8f-41d6-adbc-8a35d11c53a8",
							title: "V: Being Neighborly",
						},
						{
							id: "a95fd002-80d1-402b-888e-086b051bfa17",
							title: "VI: Beth Finds the Palace Beautiful",
						},
						{
							id: "5d31e9f5-8867-4e7f-995a-204283eadbc6",
							title: "VII: Amy’s Valley of Humiliation",
						},
						{
							id: "e0219f7b-23a0-448c-bf2d-62b9bb7d0022",
							title: "VIII: Jo Meets Apollyon",
						},
						{
							id: "59da9728-060f-4e66-abd5-f6312ce1418b",
							title: "IX: Meg Goes to Vanity Fair",
						},
						{
							id: "f3c2be28-e21d-472e-a9ab-4619bb8048f7",
							title: "X: The P.C. and P.O.",
						},
						{
							id: "bf2a352f-7744-4f01-9d68-7362c78c5253",
							title: "XI: Experiments",
						},
						{
							id: "d39bde39-37aa-4bd5-8220-f6b19fbd4bbf",
							title: "XII: Camp Laurence",
						},
						{
							id: "c83ae201-d9d0-40ec-a035-07b3eb9fd60f",
							title: "XIII: Castles in the Air",
						},
						{
							id: "7c1c083f-e6db-43b1-8b48-dec07086cc82",
							title: "XIV: Secrets",
						},
						{
							id: "b36827e4-fcd4-46c0-8fc6-4f5e12c84819",
							title: "XV: A Telegram",
						},
						{
							id: "d0545856-bc84-47e4-ac20-7dac7d105262",
							title: "XVI: Letters",
						},
						{
							id: "545a1fc6-ad91-4505-98ac-c95912ee5bda",
							title: "XVII: Little Faithful",
						},
						{
							id: "053a2330-a88c-45d7-99d0-f94fb803a040",
							title: "XVIII: Dark Days",
						},
						{
							id: "788e62d9-3651-4d4a-84aa-12e88476689c",
							title: "XIX: Amy’s Will",
						},
						{
							id: "d3bca89c-ae1a-4e9f-bd7a-160473ad4707",
							title: "XX: Confidential",
						},
						{
							id: "e1ba2d4e-68ba-4ac9-bfe5-7e10e4a79e69",
							title: "XXI: Laurie Makes Mischief, and Jo Makes Peace",
						},
						{
							id: "c3f02d71-9da3-4572-915c-f69d414cecea",
							title: "XXII: Pleasant Meadows",
						},
						{
							id: "49d4eb88-f85f-4d55-b369-a0af6eff8d22",
							title: "XXIII: Aunt March Settles the Question",
						},
					],
				},
				{
					id: "3ef6c9d7-405e-44ec-ae01-32afcadf2e7e",
					title: "Part II",
					content: [
						{
							id: "ea076ee3-1503-47fa-bec2-8d9410a974f7",
							title: "XXIV: Gossip",
						},
						{
							id: "6cba0690-e505-477d-be4b-61674b65e7d6",
							title: "XXV: The First Wedding",
						},
						{
							id: "8ebf4bde-eb93-4e46-b452-71499262a910",
							title: "XXVI: Artistic Attempts",
						},
						{
							id: "8ef25790-a31a-4485-9884-57ed15541d3e",
							title: "XXVII: Literary Lessons",
						},
						{
							id: "0dcaed1a-1f33-418d-b23a-8359c491a982",
							title: "XXVIII: Domestic Experiences",
						},
						{
							id: "5ffa4aa4-5c68-4cff-9885-f6727ae8840e",
							title: "XXIX: Calls",
						},
						{
							id: "c5b43207-dfda-494a-aaa3-6456284d1e45",
							title: "XXX: Consequences",
						},
						{
							id: "dc1c2133-2b69-4068-bf29-5fd30fa6b208",
							title: "XXXI: Our Foreign Correspondent",
						},
						{
							id: "a48add10-4414-4201-a687-a1897f5cb6fa",
							title: "XXXII: Tender Troubles",
						},
						{
							id: "5ad2fa96-6f32-4522-8259-17c358da2b9d",
							title: "XXXIII: Jo’s Journal",
						},
						{
							id: "c911558a-ef7a-4d83-bdcd-a26d46f68b43",
							title: "XXXIV: A Friend",
						},
						{
							id: "3633bd0e-16ce-4d20-a049-bf03d5ebd382",
							title: "XXXV: Heartache",
						},
						{
							id: "3e344523-69d6-4b9d-94c0-7e369ef36c61",
							title: "XXXVI: Beth’s Secret",
						},
						{
							id: "d1a7fb04-e22f-4eb5-9e91-7ef0d01eb4dc",
							title: "XXXVII: New Impressions",
						},
						{
							id: "ad26d3ac-ff49-4ed0-9350-a1c0563cb753",
							title: "XXXVIII: On the Shelf",
						},
						{
							id: "372e07ce-f0dd-47de-a687-eb8b3b7ab2cd",
							title: "XXXIX: Lazy Laurence",
						},
						{
							id: "b434eb39-fe30-4477-b35d-655e949d246b",
							title: "XL: The Valley of the Shadow",
						},
						{
							id: "ae8a5855-e02e-419a-8d78-a9a5de0c041d",
							title: "XLI: Learning to Forget",
						},
						{
							id: "765ffb58-861b-4e4d-9e18-6efef883824d",
							title: "XLII: All Alone",
						},
						{
							id: "15d40b45-50c6-47bd-b95f-4ff116ba47a7",
							title: "XLIII: Surprises",
						},
						{
							id: "0df714dd-021d-483f-95a4-46534d5440b5",
							title: "XLIV: My Lord and Lady",
						},
						{
							id: "12d83395-c362-45a9-8bc5-2a13809be456",
							title: "XLV: Daisy and Demi",
						},
						{
							id: "4d826ffc-daf3-4494-ae00-527bfb5e8c7e",
							title: "XLVI: Under the Umbrella",
						},
						{
							id: "85407938-d5d1-4237-917d-171a2b5f443d",
							title: "XLVII: Harvest Time",
						},
					],
				},
			],
		},
		{
			id: "7c663c14-5404-46e6-90aa-fc76c8f052be",
			book: "Roman de Ronce et d'Épine",
			author: ["Lucie Baratte"],
			language: "fr",
			country: "fr",
			pages: 206,
			readings: [
				{
					id: "d7b2d3a4-2566-44ff-ad2d-b834fd0262c8",
					status: "complete",
					details: [
						{
							id: "2853be3b-3235-4c5f-94a5-6c4ae4a02429",
							context: [
								{
									date: "2026-08-25",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "04e8c87d-a8a0-41b3-80e3-1162e2938f2c",
							context: [
								{
									date: "2026-08-25",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "12e0c5d7-b70a-49fc-bb20-390f0c4eaeeb",
							context: [
								{
									date: "2026-08-25",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "f842ae80-98d4-4b5b-a088-56105a3aad3a",
							context: [
								{
									date: "2026-08-26",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "403117e6-c07e-412a-8b6c-3ace22d5dbd9",
							context: [
								{
									date: "2026-08-26",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "dbf7bb5b-ef4f-4af2-abdd-41ee5217863b",
							context: [
								{
									date: "2026-08-26",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "4e8c8904-4d36-4a82-a174-52bdaec6460d",
							context: [
								{
									date: "2026-08-26",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "db4c7d89-491e-4a86-95ba-cd45b03e281e",
							context: [
								{
									date: "2026-08-26",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "e27ec2da-aca7-46bb-b8e1-c87993bc911d",
							context: [
								{
									date: "2026-08-28",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "bd3bea88-bb22-4315-8f7e-294868d308bd",
							context: [
								{
									date: "2026-08-28",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "41dc4305-2549-4eb6-958a-11e28a738c3e",
							context: [
								{
									date: "2026-08-28",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "f9f5b8d7-870c-4f4b-8145-411f4cd3751c",
							context: [
								{
									date: "2026-08-28",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "702ee7a3-c1e8-4262-b77f-987f7c5522fc",
							context: [
								{
									date: "2026-08-28",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "44f28ff5-0271-4fc4-ae1a-592e7485e47f",
							context: [
								{
									date: "2026-08-28",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "d88552ed-85f4-40ba-9cf8-74bc4a8d26fb",
							context: [
								{
									date: "2026-08-29",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "a604d4a8-c854-453f-825a-0281a2c4d6aa",
							context: [
								{
									date: "2026-08-29",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "cdfb5f13-69d8-4b9d-a841-f383dbaf7d26",
							context: [
								{
									date: "2026-08-29",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "59a0afb0-52b1-445a-bae9-699258eb5ecc",
							context: [
								{
									date: "2026-08-29",
									tags: ["dodo"],
								},
							],
						},
						{
							id: "0fa12198-e933-4b8e-a69f-4e757e098378",
							context: [
								{
									date: "2026-08-29",
									tags: ["dodo"],
								},
							],
						},
					],
				},
			],
			model: [
				{
					id: "2853be3b-3235-4c5f-94a5-6c4ae4a02429",
					title: "Au commencement était le printemps",
				},
				{
					id: "04e8c87d-a8a0-41b3-80e3-1162e2938f2c",
					title: "Amour de mai, Joli bébé",
				},
				{
					id: "12e0c5d7-b70a-49fc-bb20-390f0c4eaeeb",
					title: "Automne à la prière, Ombres au cimetière",
				},
				{
					id: "f842ae80-98d4-4b5b-a088-56105a3aad3a",
					title: "Automne errant, Démon rampant",
				},
				{
					id: "403117e6-c07e-412a-8b6c-3ace22d5dbd9",
					title: "Hiver sans sou ni maille, Rien de bon qui vaille",
				},
				{
					id: "dbf7bb5b-ef4f-4af2-abdd-41ee5217863b",
					title: "Nuit hivernale, Enfantement brutal",
				},
				{
					id: "4e8c8904-4d36-4a82-a174-52bdaec6460d",
					title: "Hiver amaigri, Confiance trahie",
				},
				{
					id: "db4c7d89-491e-4a86-95ba-cd45b03e281e",
					title: "Printemps tumultueux, Printemps contagieux",
				},
				{
					id: "e27ec2da-aca7-46bb-b8e1-c87993bc911d",
					title: "Été ardent, Orage menaçant",
				},
				{
					id: "bd3bea88-bb22-4315-8f7e-294868d308bd",
					title: "Automne brumeux, Présage malheureux",
				},
				{
					id: "41dc4305-2549-4eb6-958a-11e28a738c3e",
					title: "Hiver impatient, Nuit de tourments",
				},
				{
					id: "f9f5b8d7-870c-4f4b-8145-411f4cd3751c",
					title: "Sans saison se tisse",
				},
				{
					id: "702ee7a3-c1e8-4262-b77f-987f7c5522fc",
					title: "Printemps inattendu, Piège tendu",
				},
				{
					id: "44f28ff5-0271-4fc4-ae1a-592e7485e47f",
					title: "Hiver qui envahit, Mal qui grandit",
				},
				{
					id: "d88552ed-85f4-40ba-9cf8-74bc4a8d26fb",
					title: "Printemps sexuel, Piège charnel",
				},
				{
					id: "a604d4a8-c854-453f-825a-0281a2c4d6aa",
					title: "Guerre des saisons, Ventre rond",
				},
				{
					id: "cdfb5f13-69d8-4b9d-a841-f383dbaf7d26",
					title: "Printemps criminel, Piège cruel",
				},
				{
					id: "59a0afb0-52b1-445a-bae9-699258eb5ecc",
					title: "Mai à la fenêtre, L’espoir fait renaître",
				},
				{
					id: "0fa12198-e933-4b8e-a69f-4e757e098378",
					title: "Il y eut un soir, il y eut un matin et ce fut la fin",
				},
			],
		},
	]);

	// External refs (Youtube channel, RSS feeds, france.tv links) match the fixtures served by e2e/mocks/fetch-mock.mjs
	await db.collection("internet").insertMany([
		{
			id: "982fd13b-5f14-4131-ac1a-c0575fd80f17",
			name: "Mock Podcast",
			author: "Pod Caster",
			network: "Mock Radio",
			country: "fr",
			type: "podcast",
			description: "Un podcast de test",
			tags: ["science"],
			refs: { rss: "https://feeds.example.com/mock-podcast.xml" },
			episodes: [
				{
					id: "ea2929e9-9a5f-465d-8074-4e54e83a3d19",
					name: "Podcast épisode 0",
					duration: 40,
					date: "2026-10-10",
					type: "podcast",
					created: "2026-10-10T08:00:00",
				},
				{
					id: "85bd54c7-6d92-464a-9523-c7c67016b8b5",
					name: "Podcast épisode 1",
					duration: 45,
					durationReal: 30,
					date: "2026-10-24",
					type: "podcast",
					link: "https://feeds.example.com/mock-podcast/1",
					externalId: "mock-pod-1",
					contextTags: ["metro"],
					created: "2026-10-24T08:00:00",
				},
			],
		},
		{
			id: "d06eac35-d504-433f-9e1b-6b1b33206dd3",
			name: "Mock Tube",
			author: "Mock Tuber",
			country: "fr",
			type: "youtube",
			tags: ["tech"],
			links: ["https://www.youtube.com/@mocktube"],
			refs: { youtubeChannelId: "UCmocktube00000000000001" },
			episodes: [
				{
					id: "5a00bdfc-ac2b-4129-8eb5-23a6dbd54e37",
					name: "Vidéo de septembre",
					duration: 20,
					date: "2026-09-15",
					type: "video",
					created: "2026-09-15T20:00:00",
				},
				{
					id: "02486dae-7781-4569-bea1-9ff8f30310de",
					name: "Mock video 1",
					duration: 15,
					date: "2026-10-20",
					type: "video",
					link: "https://www.youtube.com/watch?v=vid00000001",
					externalId: "vid00000001",
					tags: ["tuto"],
					comment: "Très bien",
					created: "2026-10-20T20:00:00",
				},
			],
		},
		{
			id: "f1d163a6-2dec-488d-97d3-c9de7ab16f49",
			name: "Tour de France",
			network: "France 2",
			country: "fr",
			type: "tv",
			tags: ["sport"],
			links: ["https://www.france.tv/sport/cyclisme/tour-de-france/"],
			episodes: [
				{
					id: "376f982f-86a1-428b-9c58-7c66de8f7fa4",
					name: "Étape 14",
					duration: 250,
					date: "2026-07-20",
					type: "video",
					created: "2026-07-20T18:00:00",
				},
			],
		},
		{
			id: "574153df-656c-43ff-a5ee-d497a200908d",
			name: "The Great Show",
			author: "John Doe",
			episodes: [
				{
					id: "621b2c2c-03e1-4f4a-a92a-d06bcd3e0936",
					name: "Episode 1",
					duration: 30,
					date: "2026-05-20",
					type: "video",
					created: "2026-05-20T10:00:00",
				},
				{
					id: "ce234d39-a74c-4bf4-ae05-51b1a3f50df0",
					name: "Episode 2",
					duration: 30,
					date: "2026-05-27",
					type: "video",
					created: "2026-05-27T10:00:00",
				},
			],
		},
		{
			id: "0639422a-c2f9-4bc5-97d1-bee2dc2e4753",
			name: "Second Podcast",
			type: "podcast",
			tags: ["culture"],
			refs: { rss: "https://feeds.example.com/second-podcast.xml" },
			episodes: [
				{
					id: "24307a28-65ba-479b-880f-beb23e54c378",
					name: "Second épisode",
					duration: 30,
					date: "2025-12-15",
					type: "podcast",
					created: "2025-12-15T09:00:00",
				},
			],
		},
		{
			id: "5c1ea0c8-de21-485a-a517-ead72a55b8af",
			name: "Old Show",
			episodes: [
				{
					id: "c5c06fb0-3a10-4246-93de-9735fbb0c026",
					name: "Old episode",
					duration: 60,
					date: "2025-03-10",
					type: "video",
					created: "2025-03-10T21:00:00",
				},
			],
		},
	]);
}

// Wipes every row/document (schema and indexes are kept) and re-inserts the seed.
// Use in mutating tests with `test.afterEach(resetDb)`.
async function resetDb() {
	await Promise.all([
		(async () => {
			const conn = new Client({ connectionString: TEST_POSTGRES_URL });
			await conn.connect();
			const { rows } = await conn.query(
				"SELECT format('%I.%I', schemaname, tablename) AS name FROM pg_tables WHERE schemaname IN ('money', 'show')",
			);
			// One statement for every table, so foreign keys between them don't get in the way
			await conn.query(`TRUNCATE ${rows.map((r) => r.name).join(", ")}`);
			await seedPostgres(conn);
			await conn.end();
		})(),
		(async () => {
			const client = new MongoClient(MONGO_SERVER_URL);
			await client.connect();
			const db = client.db(TEST_DB);
			for (const col of await db.listCollections().toArray()) {
				await db.collection(col.name).deleteMany({});
			}
			await seedMongo(db);
			await client.close();
		})(),
	]);
}

// Runs a query against the Postgres test database, e.g. to check rows after a UI action.
/** @returns {Promise<Record<string, any>[]>} */
async function queryDb(sql, params = []) {
	const conn = new Client({ connectionString: TEST_POSTGRES_URL });
	await conn.connect();
	try {
		const { rows } = await conn.query(sql, params);
		return rows;
	} finally {
		await conn.end();
	}
}

module.exports = { seedPostgres, seedMongo, resetDb, queryDb };
