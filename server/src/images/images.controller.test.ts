import type { NestNodeApplication } from "@nestjs/platform-node";

import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BroadcastRepository } from "../broadcast/broadcast.repository.js";
import { makeFakeDrizzle } from "../test-support/fake-drizzle.js";
import { makeFakeMongo } from "../test-support/fake-mongo.js";
import { buildTestApp, makeFakeStorage } from "../test-support/test-app.js";
import { ImagesModule } from "./images.module.js";

const ID = "11111111-1111-4111-8111-111111111111";
const OWNER = { user: { id: "owner" }, session: { id: "session" } };

// an S3 GetObject answer: the body is a Node stream
const s3Object = (content: string, extra: object = {}) => ({
	ContentType: "image/avif",
	Body: Readable.from([Buffer.from(content)]),
	...extra,
});

async function setup(session: unknown = null) {
	const { mongo, collection } = makeFakeMongo();
	const { db, table } = makeFakeDrizzle();
	const storage = makeFakeStorage();
	const app = await buildTestApp(ImagesModule, { mongoDb: mongo.db, drizzle: db, session, storage });
	return {
		app,
		storage,
		broadcast: {
			findById: vi.spyOn(BroadcastRepository.prototype, "findById").mockResolvedValue(null),
			findEpisodeCover: vi
				.spyOn(BroadcastRepository.prototype, "findEpisodeCover")
				.mockResolvedValue(undefined as never),
		},
		sport: collection("sport"),
		game: collection("game"),
		media: table("showMedia"),
	};
}

describe("ImagesController", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		vi.restoreAllMocks();
		await app.close();
	});

	describe("broadcast", () => {
		it("404s for an unknown image field", async () => {
			({ app } = await setup());
			expect((await app.inject({ method: "GET", url: "/images/broadcast/some-id.thumbnail" })).statusCode).toBe(
				404,
			);
		});

		// the repository hides the private programs from visitors (see broadcast.controller.test.ts)
		it("looks the program up through the repository, 404 without an image key", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "GET", url: "/images/broadcast/prog-1.profile" });

			expect(res.statusCode).toBe(404);
			expect(ctx.broadcast.findById).toHaveBeenCalledWith("prog-1");
		});

		it("streams the stored image with its type and a day of cache", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.broadcast.findById.mockResolvedValue({
				id: "prog-1",
				tracking: "feed",
				name: "Prog",
				credits: [],
				episodes: [],
				profile: "personal-tracker/broadcast/prog-1.profile.avif",
			});
			ctx.storage.get.mockResolvedValue(s3Object("avif-bytes"));

			const res = await app.inject({ method: "GET", url: "/images/broadcast/prog-1.profile" });

			expect(res.statusCode).toBe(200);
			expect(res.headers).toMatchObject({
				"content-type": "image/avif",
				"cache-control": "public, max-age=86400",
			});
			expect(res.body).toBe("avif-bytes");
			expect(ctx.storage.get).toHaveBeenCalledWith("personal-tracker/broadcast/prog-1.profile.avif");
		});

		it("404s when the object is missing from S3", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.broadcast.findById.mockResolvedValue({
				id: "prog-1",
				tracking: "feed",
				name: "Prog",
				credits: [],
				episodes: [],
				banner: "gone.avif",
			});
			ctx.storage.get.mockRejectedValue(new Error("NoSuchKey"));

			expect((await app.inject({ method: "GET", url: "/images/broadcast/prog-1.banner" })).statusCode).toBe(404);
		});
	});

	describe("broadcast episode", () => {
		const EPISODE = "22222222-2222-4222-8222-222222222222";

		it("rejects a non-uuid id, without a lookup", async () => {
			const ctx = await setup();
			app = ctx.app;
			expect((await app.inject({ method: "GET", url: "/images/broadcast/episode/x" })).statusCode).toBe(400);
			expect(ctx.broadcast.findEpisodeCover).not.toHaveBeenCalled();
		});

		// the repository hides the episodes of a private program from visitors
		it("404s for an episode without cover, streams the stored one otherwise", async () => {
			const ctx = await setup();
			app = ctx.app;
			expect((await app.inject({ method: "GET", url: `/images/broadcast/episode/${EPISODE}` })).statusCode).toBe(
				404,
			);
			expect(ctx.broadcast.findEpisodeCover).toHaveBeenCalledWith(EPISODE);

			ctx.broadcast.findEpisodeCover.mockResolvedValue({
				coverKey: "personal-tracker/broadcast/episode/abc.avif",
			});
			ctx.storage.get.mockResolvedValue(s3Object("img"));
			const res = await app.inject({ method: "GET", url: `/images/broadcast/episode/${EPISODE}?v=abc` });
			expect(res.statusCode).toBe(200);
			expect(ctx.storage.get).toHaveBeenCalledWith("personal-tracker/broadcast/episode/abc.avif");
		});
	});

	describe("game", () => {
		it("rejects an unknown picture field or a malformed id, without a lookup", async () => {
			const ctx = await setup();
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: `/images/game/${ID}/poster` })).statusCode).toBe(400);
			expect((await app.inject({ method: "GET", url: "/images/game/not-an-id/capsule" })).statusCode).toBe(400);
			expect(ctx.game.findOne).not.toHaveBeenCalled();
		});

		it("404s when the game has no picture of that kind", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.game.findOne.mockResolvedValue({ id: ID, header: "personal-tracker/game/x.header.avif" });

			expect((await app.inject({ method: "GET", url: `/images/game/${ID}/capsule` })).statusCode).toBe(404);
			expect(ctx.game.findOne).toHaveBeenCalledWith({ id: ID });
		});

		it("serves a picture for revalidation, 304 while it is unchanged", async () => {
			const ctx = await setup();
			app = ctx.app;
			ctx.game.findOne.mockResolvedValue({ id: ID, capsule: "personal-tracker/game/x.capsule.avif" });
			ctx.storage.get.mockImplementation(async () => s3Object("avif", { ETag: '"v1"' }));

			const first = await app.inject({ method: "GET", url: `/images/game/${ID}/capsule` });
			const again = await app.inject({
				method: "GET",
				url: `/images/game/${ID}/capsule`,
				headers: { "if-none-match": '"v1"' },
			});
			// replaced in the form: new ETag, sent again
			ctx.storage.get.mockImplementation(async () => s3Object("new", { ETag: '"v2"' }));
			const replaced = await app.inject({
				method: "GET",
				url: `/images/game/${ID}/capsule`,
				headers: { "if-none-match": '"v1"' },
			});

			expect(first.statusCode).toBe(200);
			expect(first.headers).toMatchObject({ etag: '"v1"', "cache-control": "private, no-cache" });
			expect(again.statusCode).toBe(304);
			expect(again.body).toBe("");
			expect(replaced.statusCode).toBe(200);
			expect(replaced.body).toBe("new");
		});
	});

	describe("sport", () => {
		it("keeps the thumbnails for the owner", async () => {
			({ app } = await setup(null));
			expect((await app.inject({ method: "GET", url: "/images/sport/act-1/thumbnail" })).statusCode).toBe(401);
		});

		it("404s when the activity has no thumbnail key", async () => {
			const ctx = await setup(OWNER);
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: "/images/sport/act-1/thumbnail" })).statusCode).toBe(404);
			expect(ctx.sport.findOne).toHaveBeenCalled();
		});
	});

	describe("show", () => {
		it("404s for a non-uuid media id, without a lookup", async () => {
			const ctx = await setup();
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: "/images/show/42" })).statusCode).toBe(404);
			expect(ctx.media.findFirst).not.toHaveBeenCalled();
		});

		it("404s for an unknown media, after looking it up by id", async () => {
			const ctx = await setup();
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: `/images/show/${ID}` })).statusCode).toBe(404);
			expect(ctx.media.findFirst).toHaveBeenCalledWith({ where: { id: ID }, columns: { key: true } });
		});
	});
});
