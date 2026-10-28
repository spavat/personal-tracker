import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	SpectacleDetailsParamsRequestSchema,
	SpectacleGroupedListRequestSchema,
} from "@shared/dist/schemas/show.schema";

import { SpectacleRepository } from "./spectacle.repository";
import { GetGroupedSpectaclesUseCase, GetSpectacleUseCase, ListSpectaclesUseCase } from "./spectacle.useCases";

const spectaclesRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new SpectacleRepository(fastify.db);
	const listSpectacles = new ListSpectaclesUseCase(repository);
	const getGroupedSpectacles = new GetGroupedSpectaclesUseCase(repository);
	const getSpectacle = new GetSpectacleUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get("/", async (request) => listSpectacles.execute(request.log));

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/grouped",
		{
			schema: { querystring: SpectacleGroupedListRequestSchema },
		},
		async (request): Promise<any> => getGroupedSpectacles.execute(request.query.groupByYear, request.log),
	);
	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			schema: { params: SpectacleDetailsParamsRequestSchema },
		},
		async (request, reply): Promise<any> =>
			(await getSpectacle.execute(request.params.id, request.log)) ?? reply.notFound("Spectacle introuvable"),
	);
};

export default spectaclesRoutes;
