import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeFakeMongo } from "../../test-support/fake-mongo";
import { buildRouteApp } from "../../test-support/route-harness";
import imagesRoutes from "./images.routes";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(imagesRoutes, { mongo });
	return { app, internet: collection("internet"), sport: collection("sport") };
}

describe("images routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("404s for an unknown image field", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/internet/some-id.thumbnail" });
		expect(res.statusCode).toBe(404);
	});

	it("404s when the program has no image key, after looking it up by id", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/internet/prog-1.profile" });
		expect(res.statusCode).toBe(404);
		expect(ctx.internet.findOne).toHaveBeenCalledWith({ id: "prog-1" });
	});

	it("404s when the activity has no thumbnail key", async () => {
		const res = await ctx.app.inject({ method: "GET", url: "/sport/act-1/thumbnail" });
		expect(res.statusCode).toBe(404);
		expect(ctx.sport.findOne).toHaveBeenCalled();
	});
});
