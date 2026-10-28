// Records the JSON returned by every money endpoint (and the DB state after each mutation)
// into a folder, so two runs can be diffed: `node api-snapshot.js <outDir>`.
// Expects the server to run on the test DB (port 3001).
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const { resetDb } = require("./seed");
const { TEST_POSTGRES_URL } = require("./db-config");

const BASE = process.env.API_URL ?? "http://localhost:3001";
const MONEY_TABLES = [
	"money.bank",
	"money.account",
	"money.account_history",
	"money.payment_type",
	"money.category",
	"money.tag",
	"money.transaction",
	"money.transaction_tag",
];

const NESTED_KEYS = ["accounts", "children", "tags", "paymentTypes", "history"];

const GETS = [
	"/money/banks",
	"/money/banks/1",
	"/money/banks/999",
	"/money/banks/overview",
	"/money/banks/tree",
	"/money/accounts",
	"/money/accounts/1",
	"/money/accounts/1/details",
	"/money/accounts/4/details",
	"/money/accounts/999",
	"/money/paymentTypes",
	"/money/paymentTypes/1",
	"/money/paymentTypes/4/details",
	"/money/paymentTypes/999",
	"/money/categories",
	"/money/categories/1",
	"/money/categories/4",
	"/money/categories/999",
	"/money/tags",
	"/money/tags/1",
	"/money/tags/999",
	"/money/tags/analytics?splitParent=false",
	"/money/tags/analytics?splitParent=true",
	"/money/recap?from=2026-01-01&to=2026-12-31&regroupCategory=false",
	"/money/recap?from=2026-01-01&to=2026-12-31&regroupCategory=true",
	"/money/recap?from=2025-01-01&to=2025-12-31&regroupCategory=true",
	"/money/transactions?from=2026-01-01&to=2026-12-31",
	"/money/transactions?from=2025-01-01&to=2026-12-31&dateOrder=considerationDate",
	"/money/transactions?from=2025-01-01&to=2026-12-31&searchText=Groc",
	"/money/transactions/1",
	"/money/transactions/3",
	"/money/transactions/999",
	"/money/transactions/account/1",
	"/money/transactions/account/4",
	"/money/transactions/category/1",
	"/money/transactions/category/2",
	"/money/transactions/category/4",
	"/money/transactions/category/5",
	"/money/transactions/tag/1",
	"/money/transactions/tag/2",
];

const style = { icon: "fas fa-star", textColor: "#000000", backgroundColor: "#ffffff" };
const MUTATIONS = [
	["POST", "/money/banks", { name: "New Bank" }],
	["POST", "/money/banks/1", { name: "Renamed Bank" }],
	["POST", "/money/banks/999", { name: "Ghost" }],
	["DELETE", "/money/banks/2"],
	["DELETE", "/money/banks/999"],
	["POST", "/money/accounts", { name: "New Account", ...style, bankId: 3 }],
	["POST", "/money/accounts/1", { name: "Renamed Account" }],
	["DELETE", "/money/accounts/2"],
	["DELETE", "/money/accounts/4"],
	["POST", "/money/paymentTypes", { name: "New PT", ...style, accountId: 2 }],
	["POST", "/money/paymentTypes/1", { name: "Renamed PT" }],
	["DELETE", "/money/paymentTypes/2"],
	["DELETE", "/money/paymentTypes/1"],
	["POST", "/money/categories", { name: "New Cat", ...style, parentId: null }],
	["POST", "/money/categories/1", { name: "Renamed Cat" }],
	["DELETE", "/money/categories/3"],
	["DELETE", "/money/categories/2"],
	["POST", "/money/tags", { name: "New Tag", ...style, parentId: null }],
	["POST", "/money/tags/2", { name: "Renamed Tag" }],
	["DELETE", "/money/tags/2"],
	["DELETE", "/money/tags/1"],
	[
		"POST",
		"/money/transactions",
		{
			name: "Simple",
			date: "2026-06-20",
			considerationDate: "2026-06-21",
			amount: -12.34,
			comment: "a comment",
			categoryId: 1,
			paymentTypeId: 1,
			tags: [{ id: 1 }, { id: 2 }],
			children: [],
		},
	],
	[
		"POST",
		"/money/transactions",
		{
			name: "With children",
			date: "2026-06-20",
			considerationDate: "2026-06-20",
			amount: -30,
			categoryId: 0,
			paymentTypeId: 0,
			tags: [],
			children: [
				{
					name: "c1",
					amount: -10,
					considerationDate: "2026-06-20",
					categoryId: 1,
					paymentTypeId: 1,
					tags: [{ id: 1 }],
				},
				{
					name: "c2",
					amount: -20,
					considerationDate: "2026-06-20",
					categoryId: 2,
					paymentTypeId: 0,
					tags: [],
				},
			],
		},
	],
	[
		"POST",
		"/money/transactions/3/full",
		{
			id: 3,
			name: "Auchan updated",
			date: "2026-06-10",
			considerationDate: "2026-06-11",
			amount: -45,
			categoryId: 0,
			paymentTypeId: 0,
			tags: [],
			children: [
				{
					id: 4,
					name: "Groceries",
					amount: -10,
					considerationDate: "2026-06-10",
					categoryId: 1,
					paymentTypeId: 1,
					comment: "child comment",
					tags: [{ id: 2 }],
				},
				{
					name: "New child",
					amount: -15,
					considerationDate: "2026-06-10",
					categoryId: 3,
					paymentTypeId: 1,
					tags: [{ id: 1 }],
				},
			],
		},
	],
	[
		"POST",
		"/money/transactions/1/full",
		{
			id: 1,
			name: "Groceries 2",
			date: "2026-06-02",
			considerationDate: "2026-06-02",
			amount: -50,
			categoryId: 1,
			paymentTypeId: 4,
			tags: [{ id: 2 }],
			children: [],
		},
	],
	["POST", "/money/transactions/4/quick", { id: 4, name: "Quick", amount: -11, categoryId: 1, paymentTypeId: 1 }],
	["DELETE", "/money/transactions/1"],
	["DELETE", "/money/transactions/3"],
	// Payloads shaped like the front form (booleans, time, nested objects from the GET)
	[
		"POST",
		"/money/transactions",
		{
			name: "Form",
			description: "desc",
			date: "2026-06-20",
			time: "12:30:00",
			considerationDate: "2026-06-20",
			amount: 99.99,
			comment: "",
			recurrent: true,
			informative: false,
			categoryId: 2,
			paymentTypeId: 3,
			tags: [
				{
					id: 2,
					name: "Food\\Drink",
					icon: "fas fa-wine-glass",
					textColor: "#ffffff",
					backgroundColor: "#813d9c",
					parentId: null,
				},
			],
			children: [],
			withChildren: false,
		},
	],
	[
		"POST",
		"/money/transactions/3/full",
		{
			id: 3,
			name: "Auchan",
			description: null,
			date: "2026-06-10",
			time: "00:00:00",
			considerationDate: "2026-06-10",
			amount: -30,
			comment: null,
			parentId: null,
			recurrent: false,
			informative: true,
			categoryId: 0,
			paymentTypeId: 0,
			category: null,
			paymentType: null,
			tags: [],
			withChildren: true,
			children: [
				{
					id: 4,
					name: "Groceries",
					description: null,
					date: "2026-06-10",
					time: null,
					considerationDate: "2026-06-10",
					amount: -10,
					comment: null,
					parentId: 3,
					recurrent: null,
					informative: null,
					categoryId: 1,
					paymentTypeId: 1,
					category: {
						id: 1,
						name: "Food",
						icon: "fas fa-utensils",
						textColor: "#3e3e3e",
						backgroundColor: "#39d006",
						parentId: null,
					},
					paymentType: {
						id: 1,
						name: "Card Main Bank",
						icon: "far fa-credit-card",
						textColor: "#fff",
						backgroundColor: "#9c27b0",
						accountId: 1,
					},
					tags: [
						{
							id: 1,
							name: "Food\\Miam",
							icon: "fas fa-cookie-bite",
							textColor: "#000000",
							backgroundColor: "#f6d32d",
							parentId: null,
						},
					],
				},
			],
		},
	],
];

async function call(method, url, body) {
	const res = await fetch(BASE + url, {
		method,
		headers: body ? { "Content-Type": "application/json" } : {},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const text = await res.text();
	let parsed = text;
	try {
		// Nested relations (bank accounts, sub-categories...) have no ORDER BY: sort them to get a stable output
		parsed = JSON.parse(text, (key, value) => {
			// Join-table row added by Sequelize in each tag, unused by the front
			if (key === "TransactionTag") return undefined;
			return NESTED_KEYS.includes(key) && Array.isArray(value) ? value.sort((a, b) => a.id - b.id) : value;
		});
	} catch {}
	return { status: res.status, body: parsed };
}

// resetDb restarts the id sequences, so created ids are the same on every run
async function freshDb() {
	await resetDb();
}

async function dumpDb() {
	const conn = new Client({ connectionString: TEST_POSTGRES_URL });
	await conn.connect();
	const out = {};
	for (const table of MONEY_TABLES) {
		const { rows } = await conn.query(`SELECT * FROM ${table} ORDER BY 1, 2`);
		out[table] = rows;
	}
	await conn.end();
	return out;
}

// Keys are sorted: the key order differs between ORMs and does not matter in JSON
const sortKeys = (value) =>
	Array.isArray(value)
		? value.map(sortKeys)
		: value && typeof value === "object" && !(value instanceof Date)
			? Object.fromEntries(
					Object.keys(value)
						.sort()
						.map((k) => [k, sortKeys(value[k])]),
				)
			: value;
const stringify = (data) => JSON.stringify(sortKeys(data), null, 2) + "\n";

const fileName = (method, url) => `${method} ${url}`.replace(/[^a-zA-Z0-9=&-]+/g, "_") + ".json";

async function main() {
	// `--resort <dir>`: re-sort the keys of an existing snapshot
	if (process.argv[2] === "--resort") {
		const dir = process.argv[3];
		for (const f of fs.readdirSync(dir)) {
			fs.writeFileSync(path.join(dir, f), stringify(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
		}
		return;
	}
	const outDir = process.argv[2];
	if (!outDir) throw new Error("usage: node api-snapshot.js <outDir>");
	fs.mkdirSync(outDir, { recursive: true });
	const write = (name, data) => fs.writeFileSync(path.join(outDir, name), stringify(data));

	await freshDb();
	for (const url of GETS) {
		write(fileName("GET", url), await call("GET", url));
	}
	for (const [i, [method, url, body]] of MUTATIONS.entries()) {
		await freshDb();
		const response = await call(method, url, body);
		write(`${String(i).padStart(2, "0")}_${fileName(method, url)}`, { response, db: await dumpDb() });
	}
	await freshDb();
	console.log(`[snapshot] ${GETS.length + MUTATIONS.length} files written in ${outDir}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
