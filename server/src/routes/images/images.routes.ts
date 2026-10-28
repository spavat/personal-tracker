import type { FastifyPluginAsync } from "fastify";

import "@fastify/mongodb";

import { ImageStorageRepository } from "../internet/image-storage.repository";
import { InternetRepository } from "../internet/internet.repository";
import { SportRepository } from "../sport/sport.repository";
import { ThumbnailStorageRepository } from "../sport/thumbnail-storage.repository";

const images: FastifyPluginAsync = async (fastify): Promise<void> => {
	const internetRepository = new InternetRepository(fastify.mongo);
	const imageStorage = new ImageStorageRepository();
	const sportRepository = new SportRepository(fastify.mongo);
	const thumbnailStorage = new ThumbnailStorageRepository();

	fastify.get("/internet/:key", async (request, reply) => {
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
};

export default images;
