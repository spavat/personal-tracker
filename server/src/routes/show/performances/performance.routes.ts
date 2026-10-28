import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	PerformanceDetailsParamsRequestSchema,
	PerformanceListQuerystringRequestSchema,
	PerformanceListResponse,
	SaveCastingBodyRequestSchema,
	SavePerformanceBodyRequestSchema,
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
		async (request): Promise<Array<PerformanceListResponse>> =>
			listPerformances.execute(request.query, request.log),
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

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/save", { schema: { body: SavePerformanceBodyRequestSchema } }, async (request) =>
			savePerformance.execute(request.body, request.log),
		);
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/saveCasting", { schema: { body: SaveCastingBodyRequestSchema } }, async (request) =>
			saveCasting.execute(request.body, request.log),
		);
};

export default performancesRoutes;
