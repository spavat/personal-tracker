import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import { GetLatestResponseSchema } from "@personal-tracker/shared/home";

import { GameRepository } from "../game/game.repository";
import { GameImageStorageRepository } from "../game/image-storage.repository";
import { ImageStorageRepository as InternetImageStorageRepository } from "../internet/image-storage.repository";
import { InternetRepository } from "../internet/internet.repository";
import { MusicRepository } from "../music/music.repository";
import { BookRepository } from "../reading-book/book.repository";
import { MangaRepository } from "../reading-manga/manga.repository";
import { PerformanceRepository } from "../show/performances/performance.repository";
import { GetLatestUseCase } from "./home.useCases";

const homeRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const getLatest = new GetLatestUseCase(
		new GameRepository(fastify.mongo),
		new GameImageStorageRepository(),
		new PerformanceRepository(fastify.db),
		new MusicRepository(fastify.mongo),
		new InternetRepository(fastify.mongo),
		new InternetImageStorageRepository(),
		new MangaRepository(fastify.mongo),
		new BookRepository(fastify.mongo),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/latest",
		{
			config: { public: true },
			schema: {
				response: {
					200: GetLatestResponseSchema,
				},
			},
		},
		async (request) => getLatest.execute(request.log),
	);
};

export default homeRoutes;
