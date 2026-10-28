import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	DeleteModelParamsRequestSchema,
	ModelDetailsParamsRequestSchema,
	SaveModelBodyRequestSchema,
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
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/save", { schema: { body: SaveModelBodyRequestSchema } }, async (request) =>
			saveModel.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeleteModelParamsRequestSchema } }, async (request) =>
			deleteModel.execute(request.params.id, request.log),
		);
};

export default modelsRoutes;
