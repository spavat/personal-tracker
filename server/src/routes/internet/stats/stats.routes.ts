import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	FortnightStatsResponseSchema,
	StatsArrayResponseSchema,
	StatsRequestSchema,
} from "@personal-tracker/shared/internet";
import "@fastify/mongodb";

import { InternetRepository } from "../internet.repository";
import { GetFortnightStatsUseCase, GetStatsUseCase } from "./stats.useCases";

const stats: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new InternetRepository(fastify.mongo);

	const getStats = new GetStatsUseCase(repository);
	const getFortnightStats = new GetFortnightStatsUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			config: { public: true },
			schema: {
				querystring: StatsRequestSchema,
				response: {
					200: StatsArrayResponseSchema,
				},
			},
		},
		async (request) => getStats.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/fortnight",
		{
			config: { public: true },
			schema: {
				response: {
					200: FortnightStatsResponseSchema,
				},
			},
		},
		async (request) => getFortnightStats.execute(request.log),
	);
};

export default stats;
