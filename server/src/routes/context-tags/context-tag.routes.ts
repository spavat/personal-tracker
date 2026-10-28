import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import {
	DeleteContextTagParamsRequestSchema,
	ListResponseSchema,
	SaveContextTagRequestSchema,
} from "@personal-tracker/shared/context-tag";

import { ContextTagRepository } from "./context-tag.repository";
import { DeleteContextTagUseCase, ListContextTagsUseCase, SaveContextTagUseCase } from "./context-tag.useCases";

const contextTags: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new ContextTagRepository(fastify.mongo);
	const listContextTags = new ListContextTagsUseCase(repository);
	const saveContextTag = new SaveContextTagUseCase(repository);
	const deleteContextTag = new DeleteContextTagUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/list",
		{
			schema: {
				response: {
					200: ListResponseSchema,
				},
			},
		},
		async (request): Promise<any> => listContextTags.execute(request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SaveContextTagRequestSchema,
			},
		},
		async (request) => saveContextTag.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/:id",
		{
			schema: { params: DeleteContextTagParamsRequestSchema },
		},
		async (request) => deleteContextTag.execute(request.params.id, request.log),
	);
};

export default contextTags;
