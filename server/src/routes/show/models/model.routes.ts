import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	DeleteModelParamsRequestSchema,
	ModelDetailsParamsRequestSchema,
	SaveModelBodyRequestSchema,
	SaveModelResponseSchema,
} from "@personal-tracker/shared/show";

import { ModelRepository } from "./model.repository";
import { DeleteModelUseCase, GetModelUseCase, SaveModelUseCase } from "./model.useCases";

const modelsRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new ModelRepository(fastify.db);
	const getModel = new GetModelUseCase(repository);
	const saveModel = new SaveModelUseCase(repository);
	const deleteModel = new DeleteModelUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			schema: { params: ModelDetailsParamsRequestSchema },
		},
		async (request, reply): Promise<any> =>
			(await getModel.execute(request.params.id, request.log)) ?? reply.notFound("Modèle introuvable"),
	);
	// 201 with the new model on create, 200 with the updated one on update
	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SaveModelBodyRequestSchema,
				response: { 200: SaveModelResponseSchema, 201: SaveModelResponseSchema },
			},
		},
		async (request, reply) =>
			reply.code(request.body.id ? 200 : 201).send(await saveModel.execute(request.body, request.log)),
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeleteModelParamsRequestSchema } }, async (request, reply) => {
			await deleteModel.execute(request.params.id, request.log);
			return reply.code(204).send();
		});
};

export default modelsRoutes;
