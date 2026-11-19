import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	LatestEpisodesResponse,
	LatestGenericQuerystringRequestSchema,
	LatestParamsRequestSchema,
	LatestQuerystringRequestSchema,
} from "@personal-tracker/shared/internet";
import "@fastify/mongodb";

import { InternetRepository } from "../internet.repository";
import { latestEpisodesCache } from "../latest-episodes-cache.repository";
import { GetLatestEpisodesForProgramUseCase, GetLatestEpisodesUseCase } from "./latest.useCases";

const latest: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new InternetRepository(fastify.mongo);

	const getLatestEpisodes = new GetLatestEpisodesUseCase();
	const getLatestEpisodesForProgram = new GetLatestEpisodesForProgramUseCase(repository, latestEpisodesCache);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			schema: { querystring: LatestGenericQuerystringRequestSchema },
		},
		async (request): Promise<LatestEpisodesResponse> => getLatestEpisodes.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:programId",
		{
			schema: {
				params: LatestParamsRequestSchema,
				querystring: LatestQuerystringRequestSchema,
			},
		},
		async (request): Promise<LatestEpisodesResponse> =>
			getLatestEpisodesForProgram.execute(request.params.programId, request.query.force, request.log),
	);
};

export default latest;
