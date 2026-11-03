import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	PerformanceDetailsParamsRequestSchema,
	PerformanceListQuerystringRequestSchema,
	SaveCastingBodyRequestSchema,
	SavePerformanceBodyRequestSchema,
	SavePerformanceResponseSchema,
} from "@personal-tracker/shared/show";

import { PerformanceRepository } from "./performance.repository";
import {
	GetPerformanceUseCase,
	ListPerformancesUseCase,
	SaveCastingUseCase,
	SavePerformanceUseCase,
} from "./performance.useCases";

const performancesRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new PerformanceRepository(fastify.db);
	const listPerformances = new ListPerformancesUseCase(repository);
	const getPerformance = new GetPerformanceUseCase(repository);
	const savePerformance = new SavePerformanceUseCase(repository);
	const saveCasting = new SaveCastingUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			config: { public: true },
			schema: {
				querystring: PerformanceListQuerystringRequestSchema,
			},
		},
		async (request) => listPerformances.execute(request.query, request.log),
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/:performanceId",
			{ config: { public: true }, schema: { params: PerformanceDetailsParamsRequestSchema } },
			async (request, reply) =>
				(await getPerformance.execute(request.params.performanceId, request.log)) ??
				reply.notFound("Représentation introuvable"),
		);

	// 201 with the new performance on create, 200 with the updated one on update
	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SavePerformanceBodyRequestSchema,
				response: { 200: SavePerformanceResponseSchema, 201: SavePerformanceResponseSchema },
			},
		},
		async (request, reply) =>
			reply
				.code(request.body.performance.id ? 200 : 201)
				.send(await savePerformance.execute(request.body, request.log)),
	);
	// replaces the whole casting: nothing to send back
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/saveCasting", { schema: { body: SaveCastingBodyRequestSchema } }, async (request, reply) => {
			await saveCasting.execute(request.body, request.log);
			return reply.code(204).send();
		});
};

export default performancesRoutes;
