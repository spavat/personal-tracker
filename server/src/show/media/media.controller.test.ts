import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ShowModule } from "../../show/show.module.js";
import { makeFakeDrizzle } from "../../test-support/fake-drizzle.js";
import { buildTestApp } from "../../test-support/test-app.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };
const SPECTACLE_ID = "00000000-0000-4000-8000-000000000007";

async function buildApp(builderResult: unknown = []) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildTestApp(ShowModule, { drizzle: db, session: OWNER });
	return { app, db, table };
}

describe("show/media routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /spectacles/:spectacleId filters on a valid kind", async () => {
		const res = await ctx.app.inject({ method: "GET", url: `/show/media/spectacles/${SPECTACLE_ID}?kind=poster` });
		expect(res.statusCode).toBe(200);
		expect(ctx.table("showSpectacleMedia").findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { spectacleId: SPECTACLE_ID, kind: "poster" } }),
		);
	});

	it("GET /spectacles/:spectacleId rejects an unknown kind", async () => {
		expect(
			(await ctx.app.inject({ method: "GET", url: `/show/media/spectacles/${SPECTACLE_ID}?kind=flyer` }))
				.statusCode,
		).toBe(400);
	});

	it("PUT /spectacles/:spectacleId/order is not taken for a media id", async () => {
		// empty gallery and empty list: a valid reorder
		const res = await ctx.app.inject({
			method: "PUT",
			url: `/show/media/spectacles/${SPECTACLE_ID}/order`,
			payload: { mediaIds: [] },
		});
		expect(res.statusCode).toBe(204);
	});

	it("PUT /spectacles/:spectacleId/order rejects non-uuid ids", async () => {
		const res = await ctx.app.inject({
			method: "PUT",
			url: `/show/media/spectacles/${SPECTACLE_ID}/order`,
			payload: { mediaIds: ["1"] },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /spectacles/:spectacleId rejects a missing source", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: `/show/media/spectacles/${SPECTACLE_ID}`,
			payload: { label: "x" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /spectacles/:spectacleId rejects a recording (signed upload, not available yet)", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: `/show/media/spectacles/${SPECTACLE_ID}`,
			payload: { source: "s", kind: "recording" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /spectacles/:spectacleId rejects an id that is not a uuid", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/show/media/spectacles/abc",
			payload: { source: "s" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("PUT /spectacles/:spectacleId/:mediaId 404s for a media of another spectacle", async () => {
		const res = await ctx.app.inject({
			method: "PUT",
			url: `/show/media/spectacles/${SPECTACLE_ID}/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e`,
			payload: { label: "x" },
		});
		expect(res.statusCode).toBe(404);
		expect(res.json()).toMatchObject({ statusCode: 404, code: "not_found", params: { resource: "media" } });
	});

	it("DELETE /spectacles/:spectacleId/:mediaId rejects a non-uuid media id", async () => {
		expect(
			(await ctx.app.inject({ method: "DELETE", url: `/show/media/spectacles/${SPECTACLE_ID}/42` })).statusCode,
		).toBe(400);
	});

	it("DELETE /spectacles/:spectacleId/:mediaId 404s when nothing was unlinked", async () => {
		const res = await ctx.app.inject({
			method: "DELETE",
			url: `/show/media/spectacles/${SPECTACLE_ID}/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e`,
		});
		expect(res.statusCode).toBe(404);
		expect(ctx.db.delete).toHaveBeenCalled();
	});
});

describe("show/media routes (existing link)", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		// every builder chain resolves to one row: the link exists, and is the last one
		ctx = await buildApp([{ mediaId: 42, n: 0, key: "" }]);
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("PUT /spectacles/:spectacleId/:mediaId updates the media and answers it", async () => {
		const mediaId = "0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e";
		ctx.table("showSpectacleMedia").findMany.mockResolvedValue([
			{ kind: "poster", media: { id: mediaId, key: "k", label: "Saison 2", contentType: "image/avif" } },
		]);
		const res = await ctx.app.inject({
			method: "PUT",
			url: `/show/media/spectacles/${SPECTACLE_ID}/${mediaId}`,
			payload: { label: "Saison 2" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ id: mediaId, label: "Saison 2" });
		expect(ctx.db.update).toHaveBeenCalled();
	});

	it("DELETE /spectacles/:spectacleId/:mediaId removes the link and the media", async () => {
		const res = await ctx.app.inject({
			method: "DELETE",
			url: `/show/media/spectacles/${SPECTACLE_ID}/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e`,
		});
		expect(res.statusCode).toBe(204);
		expect(ctx.db.delete).toHaveBeenCalledTimes(2);
	});
});
