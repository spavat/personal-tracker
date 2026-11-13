import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	GameSaveBodyRequestSchema,
	GameDeleteParamsRequestSchema,
	GameListQuerystringRequestSchema,
	PlayListQuerystringRequestSchema,
	DetailsGameParamsRequestSchema,
} from "@personal-tracker/shared/game";
import "@fastify/mongodb";

import { GameRepository } from "./game.repository";
import {
	DeletePlayUseCase,
	GetGameUseCase,
	ListGamesUseCase,
	ListPlaysUseCase,
	SaveGameUseCase,
} from "./game.useCases";
import { GameImageStorageRepository } from "./image-storage.repository";

const game: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new GameRepository(fastify.mongo);
	const images = new GameImageStorageRepository();
	const listGames = new ListGamesUseCase(repository, images);
	const listPlays = new ListPlaysUseCase(repository, images);
	const saveGame = new SaveGameUseCase(repository, images);
	const deletePlay = new DeletePlayUseCase(repository);
	const getGame = new GetGameUseCase(repository, images);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/games",
		{
			schema: { querystring: GameListQuerystringRequestSchema },
		},
		async (request): Promise<any> => listGames.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/plays",
		{
			schema: { querystring: PlayListQuerystringRequestSchema },
		},
		async (request) => listPlays.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: { body: GameSaveBodyRequestSchema },
		},
		async (request) => saveGame.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/games/:gameId/plays/:playId",
		{
			schema: { params: GameDeleteParamsRequestSchema },
		},
		async (request) => deletePlay.execute(request.params, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/games/:id",
		{
			schema: { params: DetailsGameParamsRequestSchema },
		},
		async (request, reply) =>
			(await getGame.execute(request.params.id, request.log)) ?? reply.notFound("Jeu introuvable"),
	);
};

export default game;
