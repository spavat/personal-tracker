import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { makeFakeMongo } from "../../test-support/fake-mongo.js";
import { buildTestApp } from "../../test-support/test-app.js";
import { ReadingBookModule } from "../reading-book.module.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };
const ENTITY_UUID = "66666666-6666-4666-8666-666666666666";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const FOLIO = {
	key: "/books/OL59879604M",
	title: "L’étranger",
	publishers: ["Gallimard"],
	languages: [{ key: "/languages/fre" }],
	isbn_10: ["2070360024"],
	works: [{ key: "/works/OL1230613W" }],
};

// Open Library answered by a stubbed fetch, the entities by the fake Drizzle
async function buildApp(entities: unknown[] = [], session: unknown = OWNER) {
	const { mongo } = makeFakeMongo();
	const { db } = makeFakeDrizzle({ builderResult: entities });
	// the domain module: it mounts the lookup routes under /reading-book/lookup
	return buildTestApp(ReadingBookModule, { mongoDb: mongo.db, drizzle: db, session });
}

describe("book lookup routes", () => {
	let fetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("GET works searches by title, with the matched author", async () => {
		const app = await buildApp([{ id: ENTITY_UUID, names: ["Albert Camus"] }]);
		fetch.mockResolvedValueOnce(
			json({ docs: [{ key: "/works/OL1230613W", title: "L’étranger", author_name: ["Albert Camus"] }] }),
		);

		const res = await app.inject({
			method: "GET",
			url: "/reading-book/lookup/openLibrary/works?title=l%27%C3%A9tranger&author=camus",
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([
			{
				source: "openLibrary",
				externalId: "OL1230613W",
				title: "L’étranger",
				authors: [{ name: "Albert Camus", entityId: ENTITY_UUID }],
				originalYear: null,
				cover: null,
			},
		]);
		await app.close();
	});

	it("GET works by ISBN: the work of the edition, none for an unknown ISBN", async () => {
		const app = await buildApp();
		fetch.mockResolvedValueOnce(new Response("", { status: 404 }));

		const res = await app.inject({
			method: "GET",
			url: "/reading-book/lookup/openLibrary/works?isbn=979-9999999990",
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
		// the hyphen is removed
		expect(fetch.mock.calls[0][0]).toBe("https://openlibrary.org/isbn/9799999999990.json");
		await app.close();
	});

	it("GET works refuses an invalid ISBN, an unknown source, or no title", async () => {
		const app = await buildApp();

		for (const url of [
			"/reading-book/lookup/openLibrary/works?isbn=12345",
			"/reading-book/lookup/amazon/works?title=Dune",
			"/reading-book/lookup/openLibrary/works",
		]) {
			expect((await app.inject({ method: "GET", url })).statusCode).toBe(400);
		}
		expect(fetch).not.toHaveBeenCalled();
		await app.close();
	});

	it("GET works/:externalId/editions filters by language", async () => {
		const app = await buildApp();
		fetch.mockResolvedValueOnce(
			json({ entries: [FOLIO, { ...FOLIO, key: "/books/OL2M", languages: [{ key: "/languages/eng" }] }] }),
		);

		const res = await app.inject({
			method: "GET",
			url: "/reading-book/lookup/openLibrary/works/OL1230613W/editions?language=fr",
		});

		expect(res.statusCode).toBe(200);
		expect(res.json().map(({ externalId }: { externalId: string }) => externalId)).toEqual(["OL59879604M"]);
		await app.close();
	});

	it("GET editions finds an edition by ISBN, with its publisher", async () => {
		const app = await buildApp();
		fetch.mockResolvedValueOnce(json(FOLIO));

		const res = await app.inject({
			method: "GET",
			url: "/reading-book/lookup/openLibrary/editions?isbn=2070360024",
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			externalId: "OL59879604M",
			publisher: { name: "Gallimard", entityId: null },
			language: "fr",
		});
		await app.close();
	});

	it("GET editions answers 404 for an unknown ISBN", async () => {
		const app = await buildApp();
		fetch.mockResolvedValueOnce(new Response("", { status: 404 }));

		const res = await app.inject({
			method: "GET",
			url: "/reading-book/lookup/openLibrary/editions?isbn=9799999999990",
		});

		expect(res.statusCode).toBe(404);
		expect(res.json()).toMatchObject({ code: "not_found", params: { resource: "edition" } });
		await app.close();
	});

	it("answers 502 when Open Library fails", async () => {
		const app = await buildApp();
		fetch.mockResolvedValueOnce(json({}, 503));

		const res = await app.inject({ method: "GET", url: "/reading-book/lookup/openLibrary/works?title=Dune" });

		expect(res.statusCode).toBe(502);
		expect(res.json()).toMatchObject({ code: "upstream_unavailable", params: { service: "openLibrary" } });
		await app.close();
	});

	it("is for the owner only", async () => {
		const app = await buildApp([], null);

		const res = await app.inject({ method: "GET", url: "/reading-book/lookup/openLibrary/works?title=Dune" });

		expect(res.statusCode).toBe(401);
		await app.close();
	});
});
