import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	SaveSpectacleBodyRequestSchema,
	SpectacleDetailsParamsRequestSchema,
	SpectacleGroupedListRequestSchema,
	SpectacleSchema,
} from "@shared/dist/schemas/show.schema";

import { SpectacleRepository } from "./spectacle.repository";
import {
	GetGroupedSpectaclesUseCase,
	GetSpectacleUseCase,
	ListSpectaclesUseCase,
	SaveSpectacleUseCase,
} from "./spectacle.useCases";

const spectaclesRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new SpectacleRepository(fastify.db);
	const listSpectacles = new ListSpectaclesUseCase(repository);
	const getGroupedSpectacles = new GetGroupedSpectaclesUseCase(repository);
	const getSpectacle = new GetSpectacleUseCase(repository);
	const saveSpectacle = new SaveSpectacleUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get("/", async (request) => listSpectacles.execute(request.log));

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/grouped",
		{
			config: { public: true },
			schema: { querystring: SpectacleGroupedListRequestSchema },
		},
		async (request): Promise<any> => getGroupedSpectacles.execute(request.query.groupByYear, request.log),
	);
	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			config: { public: true },
			schema: { params: SpectacleDetailsParamsRequestSchema },
		},
		async (request, reply): Promise<any> =>
			(await getSpectacle.execute(request.params.id, request.log)) ?? reply.notFound("Spectacle introuvable"),
	);
	// 201 with the new spectacle on create, 200 with the updated one on update
	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SaveSpectacleBodyRequestSchema,
				response: { 200: SpectacleSchema, 201: SpectacleSchema },
			},
		},
		async (request, reply) => {
			const spectacle = await saveSpectacle.execute(request.body, request.log);
			if (!spectacle) {
				return reply.notFound("Spectacle introuvable");
			}
			return reply.code(request.body.id ? 200 : 201).send(spectacle);
		},
	);
};

export default spectaclesRoutes;
