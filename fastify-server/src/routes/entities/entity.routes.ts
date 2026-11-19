import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	EntityListQuerystringRequestSchema,
	EntityListResponseSchema,
	SaveEntityBodyRequestSchema,
	SaveEntityResponseSchema,
} from "@personal-tracker/shared/entity";

import { EntityRepository } from "./entity.repository";
import { ListEntitiesUseCase, SaveEntityUseCase } from "./entity.useCases";
import { PortraitStorageRepository } from "./portrait-storage.repository";

const PORTRAIT_BODY_LIMIT = 15 * 1024 * 1024; // 15MB — the portrait can be sent as a base64 data URI

const entitiesRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new EntityRepository(fastify.db);
	const listEntities = new ListEntitiesUseCase(repository);
	const saveEntity = new SaveEntityUseCase(repository, new PortraitStorageRepository());

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			schema: {
				querystring: EntityListQuerystringRequestSchema,
				response: { 200: EntityListResponseSchema },
			},
		},
		async (request) => listEntities.execute(request.query, request.log),
	);

	// 201 with the new entity on create, 200 with the updated one on update
	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			bodyLimit: PORTRAIT_BODY_LIMIT,
			schema: {
				body: SaveEntityBodyRequestSchema,
				response: { 200: SaveEntityResponseSchema, 201: SaveEntityResponseSchema },
			},
		},
		async (request, reply) => {
			const entity = await saveEntity.execute(request.body, request.log);
			if (!entity) {
				return reply.notFound("Entité introuvable");
			}
			return reply.code(request.body.id ? 200 : 201).send(entity);
		},
	);
};

export default entitiesRoutes;
