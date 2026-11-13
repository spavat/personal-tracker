import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import { GameImageParamsSchema } from "@personal-tracker/shared/game";
import "@fastify/mongodb";
import * as z from "zod";

import { GameRepository } from "../game/game.repository";
import { GameImageStorageRepository } from "../game/image-storage.repository";
import { ImageStorageRepository } from "../internet/image-storage.repository";
import { InternetRepository } from "../internet/internet.repository";
import { MediaStorageRepository } from "../show/media/media-storage.repository";
import { MediaRepository } from "../show/media/media.repository";
import { SportRepository } from "../sport/sport.repository";
import { ThumbnailStorageRepository } from "../sport/thumbnail-storage.repository";

const images: FastifyPluginAsync = async (fastify): Promise<void> => {
	const internetRepository = new InternetRepository(fastify.mongo);
	const imageStorage = new ImageStorageRepository();
	const sportRepository = new SportRepository(fastify.mongo);
	const thumbnailStorage = new ThumbnailStorageRepository();
	const mediaRepository = new MediaRepository(fastify.db);
	const mediaStorage = new MediaStorageRepository();
	const gameRepository = new GameRepository(fastify.mongo);
	const gameImageStorage = new GameImageStorageRepository();

	// public: private programs are filtered out by the repository (findById) for anonymous visitors
	fastify.get("/internet/:key", { config: { public: true } }, async (request, reply) => {
		const { key } = request.params as { key: string };
		const separatorIndex = key.lastIndexOf(".");
		const programId = key.slice(0, separatorIndex);
		const field = key.slice(separatorIndex + 1);

		if (field !== "profile" && field !== "banner") {
			return reply.notFound();
		}

		const program = await internetRepository.findById(programId);
		const s3Key = field === "profile" ? program?.profile : program?.banner;
		if (!s3Key) {
			return reply.notFound();
		}

		try {
			const object = await imageStorage.getObject(s3Key);
			reply.header("Content-Type", object.ContentType ?? "application/octet-stream");
			reply.header("Cache-Control", "public, max-age=86400");
			return reply.send(object.Body);
		} catch {
			return reply.notFound();
		}
	});

	fastify.get("/sport/:id/thumbnail", async (request, reply) => {
		const { id } = request.params as { id: string };

		const activity = await sportRepository.findThumbnailKey(id);
		if (!activity?.thumbnailKey) {
			return reply.notFound();
		}

		try {
			const object = await thumbnailStorage.getObject(activity.thumbnailKey);
			reply.header("Content-Type", object.ContentType ?? "image/avif");
			reply.header("Cache-Control", "public, max-age=86400");
			return reply.send(object.Body);
		} catch {
			return reply.notFound();
		}
	});

	// not public, like the game module: the session cookie is sent with the <img> request
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get("/game/:id/:field", { schema: { params: GameImageParamsSchema } }, async (request, reply) => {
			const { id, field } = request.params;
			const s3Key = (await gameRepository.findById(id))?.[field];
			if (!s3Key) {
				return reply.notFound();
			}

			try {
				const object = await gameImageStorage.getObject(s3Key);
				reply.header("Content-Type", object.ContentType ?? "image/avif");
				reply.header("Cache-Control", "public, max-age=86400");
				return reply.send(object.Body);
			} catch {
				return reply.notFound();
			}
		});

	// public: show media (posters, portraits, programmes...) are visible like the rest of the show module
	fastify.get("/show/:id", { config: { public: true } }, async (request, reply) => {
		const { id } = request.params as { id: string };
		if (!z.uuid().safeParse(id).success) {
			return reply.notFound();
		}

		const key = await mediaRepository.findKey(id);
		if (!key) {
			return reply.notFound();
		}

		try {
			const object = await mediaStorage.getObject(key);
			reply.header("Content-Type", object.ContentType ?? "application/octet-stream");
			reply.header("Cache-Control", "public, max-age=86400");
			return reply.send(object.Body);
		} catch {
			return reply.notFound();
		}
	});
};

export default images;
