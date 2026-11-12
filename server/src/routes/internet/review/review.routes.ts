import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import { ReviewEpisodesResponseSchema } from "@personal-tracker/shared/internet";
import "@fastify/mongodb";

import { InternetRepository } from "../internet.repository";
import { ListUntaggedEpisodesUseCase } from "./review.useCases";

const review: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new InternetRepository(fastify.mongo);

	const listUntaggedEpisodes = new ListUntaggedEpisodesUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			schema: {
				response: {
					200: ReviewEpisodesResponseSchema,
				},
			},
		},
		async (request) => listUntaggedEpisodes.execute(request.log),
	);
};

export default review;
