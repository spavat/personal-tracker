import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeCursor, makeFakeMongo } from "../../../test-support/fake-mongo";
import { buildRouteApp } from "../../../test-support/route-harness";
import reviewRoutes from "./review.routes";

const PROGRAM_UUID = "11111111-1111-4111-8111-111111111111";
const EPISODE_UUID = "22222222-2222-4222-8222-222222222222";

async function buildApp() {
	const { mongo, collection } = makeFakeMongo();
	const app = await buildRouteApp(reviewRoutes, { mongo });
	return { app, programs: collection("internet") };
}

describe("internet review routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET / returns the untagged episodes", async () => {
		const untagged = {
			id: EPISODE_UUID,
			name: "Ep",
			duration: 30,
			date: "2020-01-02",
			type: "video",
			ignoredTags: ["news"],
		};
		const tagged = { ...untagged, id: "33333333-3333-4333-8333-333333333333", ignoredTags: undefined };
		ctx.programs.find.mockReturnValue(
			makeCursor([{ id: PROGRAM_UUID, name: "Prog", tags: ["news"], episodes: [untagged, tagged] }]),
		);

		const res = await ctx.app.inject({ method: "GET", url: "/" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([{ programId: PROGRAM_UUID, programName: "Prog", episode: untagged }]);
	});
});
