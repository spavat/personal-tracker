import { afterEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { DirectoryModule } from "./directory.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };
const ID = "0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e";

// every select answers `rows`
async function buildApp(session: unknown, rows: unknown[] = []) {
	const { db } = makeFakeDrizzle({ builderResult: rows });
	return buildTestApp(DirectoryModule, { drizzle: db, session });
}

describe("directory routes", () => {
	let app: Awaited<ReturnType<typeof buildApp>>;

	afterEach(async () => {
		await app.close();
	});

	it("GET /entities/directory is open to visitors", async () => {
		app = await buildApp(null);
		const res = await app.inject({ method: "GET", url: "/entities/directory?sort=nbBooks&sort=desc" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("GET /entities/directory/:id rejects a non-uuid id", async () => {
		app = await buildApp(OWNER);
		expect((await app.inject({ method: "GET", url: "/entities/directory/nope" })).statusCode).toBe(400);
	});

	it("GET /entities/directory/:id 404s on an unknown entity", async () => {
		app = await buildApp(OWNER);
		expect((await app.inject({ method: "GET", url: `/entities/directory/${ID}` })).statusCode).toBe(404);
	});

	it("GET /entities/directory/:id hides an entity without credit from a visitor, not from the owner", async () => {
		// the entity; the count queries read the same row, which credits no entity (no entityId) with nothing
		const rows = [
			{
				id: ID,
				kind: "person",
				name: "Lewis Carroll",
				sortName: null,
				pictureKey: null,
				spectacleIds: [],
				ids: [],
			},
		];
		app = await buildApp(null, rows);
		expect((await app.inject({ method: "GET", url: `/entities/directory/${ID}` })).statusCode).toBe(404);
		await app.close();

		app = await buildApp(OWNER, rows);
		const res = await app.inject({ method: "GET", url: `/entities/directory/${ID}` });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			id: ID,
			name: "Lewis Carroll",
			book: { books: 0 },
			episode: { episodes: 0 },
		});
	});

	describe("POST /entities/merge", () => {
		const OTHER = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

		it("is for the owner only", async () => {
			app = await buildApp(null);
			const res = await app.inject({
				method: "POST",
				url: "/entities/merge",
				payload: { keepId: ID, removeId: OTHER },
			});
			expect(res.statusCode).toBe(401);
		});

		it("rejects merging an entity into itself", async () => {
			app = await buildApp(OWNER);
			const res = await app.inject({
				method: "POST",
				url: "/entities/merge",
				payload: { keepId: ID, removeId: ID },
			});
			expect(res.statusCode).toBe(400);
		});

		it("404s on an unknown entity", async () => {
			app = await buildApp(OWNER);
			const res = await app.inject({
				method: "POST",
				url: "/entities/merge",
				payload: { keepId: ID, removeId: OTHER },
			});
			expect(res.statusCode).toBe(404);
		});
	});
});
