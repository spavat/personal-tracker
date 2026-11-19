import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import mediaRoutes from "./media.routes";

async function buildApp(builderResult: unknown = []) {
	const { db, table } = makeFakeDrizzle({ builderResult });
	const app = await buildRouteApp(mediaRoutes, { db });
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
		const res = await ctx.app.inject({ method: "GET", url: "/spectacles/7?kind=poster" });
		expect(res.statusCode).toBe(200);
		expect(ctx.table("showSpectacleMedia").findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { spectacleId: 7, kind: "poster" } }),
		);
	});

	it("GET /spectacles/:spectacleId rejects an unknown kind", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/spectacles/7?kind=flyer" })).statusCode).toBe(400);
	});

	it("GET /artists/:artistId lists the artist media", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/artists/3" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
		expect(ctx.table("showArtistMedia").findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { artistId: 3 } }),
		);
	});

	it("POST /spectacles/:spectacleId/order is not taken for a media id", async () => {
		// empty gallery and empty list: a valid reorder
		const res = await ctx.app.inject({ method: "POST", url: "/spectacles/7/order", payload: { mediaIds: [] } });
		expect(res.statusCode).toBe(204);
	});

	it("POST /artists/:artistId/order rejects non-uuid ids", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/artists/3/order", payload: { mediaIds: ["1"] } });
		expect(res.statusCode).toBe(400);
	});

	it("POST /spectacles/:spectacleId rejects a missing source", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/spectacles/7", payload: { label: "x" } });
		expect(res.statusCode).toBe(400);
	});

	it("POST /spectacles/:spectacleId rejects a recording (signed upload, not available yet)", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/spectacles/7",
			payload: { source: "s", kind: "recording" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("POST /artists/:artistId rejects a non-numeric id", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/artists/abc", payload: { source: "s" } });
		expect(res.statusCode).toBe(400);
	});

	it("POST /spectacles/:spectacleId/:mediaId 404s for a media of another spectacle", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/spectacles/7/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
			payload: { label: "x" },
		});
		expect(res.statusCode).toBe(404);
		expect(res.json().message).toBe("Média introuvable");
	});

	it("DELETE /artists/:artistId/:mediaId rejects a non-uuid media id", async () => {
		expect((await ctx.app.inject({ method: "DELETE", url: "/artists/3/42" })).statusCode).toBe(400);
	});

	it("DELETE /artists/:artistId/:mediaId 404s when nothing was unlinked", async () => {
		const res = await ctx.app.inject({ method: "DELETE", url: "/artists/3/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e" });
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

	it("POST /artists/:artistId/:mediaId updates the media", async () => {
		const res = await ctx.app.inject({
			method: "POST",
			url: "/artists/3/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
			payload: { label: "Seymour", spectacleId: 7 },
		});
		expect(res.statusCode).toBe(204);
		expect(ctx.db.update).toHaveBeenCalled();
	});

	it("DELETE /spectacles/:spectacleId/:mediaId removes the link and the media", async () => {
		const res = await ctx.app.inject({
			method: "DELETE",
			url: "/spectacles/7/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
		});
		expect(res.statusCode).toBe(204);
		expect(ctx.db.delete).toHaveBeenCalledTimes(2);
	});
});
