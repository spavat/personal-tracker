import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	ArtistMediaIdParamsRequestSchema,
	ArtistMediaParamsRequestSchema,
	ReorderMediaBodyRequestSchema,
	SpectacleMediaIdParamsRequestSchema,
	SpectacleMediaListQuerystringRequestSchema,
	SpectacleMediaParamsRequestSchema,
	UpdateMediaBodyRequestSchema,
	UploadMediaBodyRequestSchema,
} from "@personal-tracker/shared/show";

import { MediaStorageRepository } from "./media-storage.repository";
import { MediaRepository } from "./media.repository";
import {
	DeleteMediaUseCase,
	ListMediaUseCase,
	ReorderMediaUseCase,
	UpdateMediaUseCase,
	UploadMediaUseCase,
} from "./media.useCases";

const UPLOAD_BODY_LIMIT = 15 * 1024 * 1024; // 15MB — files can be sent as base64 data URIs
const NOT_FOUND = "Média introuvable";

const mediaRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new MediaRepository(fastify.db);
	const storage = new MediaStorageRepository();
	const listMedia = new ListMediaUseCase(repository);
	const uploadMedia = new UploadMediaUseCase(repository, storage);
	const updateMedia = new UpdateMediaUseCase(repository);
	const reorderMedia = new ReorderMediaUseCase(repository);
	const deleteMedia = new DeleteMediaUseCase(repository, storage);

	// SPECTACLE (poster, photo, programme)
	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/spectacles/:spectacleId",
		{
			config: { public: true },
			schema: {
				params: SpectacleMediaParamsRequestSchema,
				querystring: SpectacleMediaListQuerystringRequestSchema,
			},
		},
		async (request) =>
			listMedia.execute({ spectacleId: request.params.spectacleId }, request.query.kind, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/spectacles/:spectacleId",
		{
			bodyLimit: UPLOAD_BODY_LIMIT,
			schema: { params: SpectacleMediaParamsRequestSchema, body: UploadMediaBodyRequestSchema },
		},
		async (request, reply) =>
			reply
				.code(201)
				.send(
					await uploadMedia.execute({ spectacleId: request.params.spectacleId }, request.body, request.log),
				),
	);

	// static segment: matched before /:mediaId
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/spectacles/:spectacleId/order",
			{ schema: { params: SpectacleMediaParamsRequestSchema, body: ReorderMediaBodyRequestSchema } },
			async (request, reply) => {
				await reorderMedia.execute({ spectacleId: request.params.spectacleId }, request.body, request.log);
				return reply.code(204).send();
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/spectacles/:spectacleId/:mediaId",
			{ schema: { params: SpectacleMediaIdParamsRequestSchema, body: UpdateMediaBodyRequestSchema } },
			async (request, reply) =>
				(await updateMedia.execute(
					{ spectacleId: request.params.spectacleId },
					request.params.mediaId,
					request.body,
					request.log,
				))
					? reply.code(204).send()
					: reply.notFound(NOT_FOUND),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete(
			"/spectacles/:spectacleId/:mediaId",
			{ schema: { params: SpectacleMediaIdParamsRequestSchema } },
			async (request, reply) =>
				(await deleteMedia.execute(
					{ spectacleId: request.params.spectacleId },
					request.params.mediaId,
					request.log,
				))
					? reply.code(204).send()
					: reply.notFound(NOT_FOUND),
		);

	// ARTIST (portraits)
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/artists/:artistId",
			{ config: { public: true }, schema: { params: ArtistMediaParamsRequestSchema } },
			async (request) => listMedia.execute({ artistId: request.params.artistId }, undefined, request.log),
		);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/artists/:artistId",
		{
			bodyLimit: UPLOAD_BODY_LIMIT,
			schema: { params: ArtistMediaParamsRequestSchema, body: UploadMediaBodyRequestSchema },
		},
		async (request, reply) =>
			reply
				.code(201)
				.send(await uploadMedia.execute({ artistId: request.params.artistId }, request.body, request.log)),
	);

	// static segment: matched before /:mediaId
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/artists/:artistId/order",
			{ schema: { params: ArtistMediaParamsRequestSchema, body: ReorderMediaBodyRequestSchema } },
			async (request, reply) => {
				await reorderMedia.execute({ artistId: request.params.artistId }, request.body, request.log);
				return reply.code(204).send();
			},
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/artists/:artistId/:mediaId",
			{ schema: { params: ArtistMediaIdParamsRequestSchema, body: UpdateMediaBodyRequestSchema } },
			async (request, reply) =>
				(await updateMedia.execute(
					{ artistId: request.params.artistId },
					request.params.mediaId,
					request.body,
					request.log,
				))
					? reply.code(204).send()
					: reply.notFound(NOT_FOUND),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete(
			"/artists/:artistId/:mediaId",
			{ schema: { params: ArtistMediaIdParamsRequestSchema } },
			async (request, reply) =>
				(await deleteMedia.execute({ artistId: request.params.artistId }, request.params.mediaId, request.log))
					? reply.code(204).send()
					: reply.notFound(NOT_FOUND),
		);
};

export default mediaRoutes;
