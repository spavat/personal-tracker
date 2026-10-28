import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import {
	DetailsQuerystringRequestSchema,
	DetailsResponseSchema,
	ListQuerystringRequestSchema,
	ListResponseSchema,
	DeleteParamsRequestSchema,
	DeleteGenreParamsRequestSchema,
	SaveBodyRequestSchema,
	SaveGenreRequestSchema,
	SearchQuerystringRequestSchema,
	SearchResponseSchema,
	StatsQuerystringRequestSchema,
	GetReportResponseSchema,
	StatsResponseSchema,
	FortnightStatsResponseSchema,
	GetReportQuerystringRequestSchema,
} from "@personal-tracker/shared/music";

import { GenreRepository } from "./genre.repository";
import { CreateGenreUseCase, DeleteGenreUseCase, ListGenresUseCase, UpdateGenreUseCase } from "./genre.useCases";
import { MusicRepository } from "./music.repository";
import {
	DeleteListeningUseCase,
	GetFortnightStatsUseCase,
	GetListeningUseCase,
	GetReportUseCase,
	GetStatsUseCase,
	ListListeningsUseCase,
	SaveListeningUseCase,
	SearchListeningsUseCase,
} from "./music.useCases";

const music: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new MusicRepository(fastify.mongo);
	const genreRepository = new GenreRepository(fastify.mongo);
	const listListenings = new ListListeningsUseCase(repository);
	const searchListenings = new SearchListeningsUseCase(repository);
	const getListening = new GetListeningUseCase(repository);
	const listGenres = new ListGenresUseCase(genreRepository);
	const createGenre = new CreateGenreUseCase(genreRepository);
	const updateGenre = new UpdateGenreUseCase(genreRepository);
	const deleteGenre = new DeleteGenreUseCase(genreRepository);
	const saveListening = new SaveListeningUseCase(repository);
	const deleteListening = new DeleteListeningUseCase(repository);
	const getStats = new GetStatsUseCase(repository, genreRepository);
	const getFortnightStats = new GetFortnightStatsUseCase(repository);
	const getReport = new GetReportUseCase(repository, genreRepository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/list",
		{
			schema: {
				querystring: ListQuerystringRequestSchema,
				response: {
					200: ListResponseSchema,
				},
			},
		},
		async (request): Promise<any> => listListenings.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/search",
		{
			schema: {
				querystring: SearchQuerystringRequestSchema,
				response: {
					200: SearchResponseSchema,
				},
			},
		},
		async (request): Promise<any> => searchListenings.execute(request.query.search, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/id",
		{
			schema: {
				querystring: DetailsQuerystringRequestSchema,
				response: {
					200: DetailsResponseSchema,
				},
			},
		},
		async (request, reply): Promise<any> =>
			(await getListening.execute(request.query.id, request.log)) ?? reply.notFound("Écoute introuvable"),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get("/genres", async (request) => listGenres.execute(request.log));

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/genres/save",
		{
			schema: {
				body: SaveGenreRequestSchema,
			},
		},
		async (request) => {
			const { id, ...data } = request.body;
			if (id) {
				return updateGenre.execute({ id, input: data }, request.log);
			}
			return createGenre.execute(data, request.log);
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/genres/:id",
		{
			schema: { params: DeleteGenreParamsRequestSchema },
		},
		async (request) => deleteGenre.execute(request.params.id, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SaveBodyRequestSchema,
			},
		},
		async (request) => saveListening.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/:id",
		{
			schema: { params: DeleteParamsRequestSchema },
		},
		async (request) => deleteListening.execute(request.params.id, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/stats",
		{
			schema: {
				querystring: StatsQuerystringRequestSchema,
				response: {
					200: StatsResponseSchema,
				},
			},
		},
		async (request) => getStats.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/fortnight-stats",
		{
			schema: {
				response: {
					200: FortnightStatsResponseSchema,
				},
			},
		},
		async (request) => getFortnightStats.execute(request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/reports",
		{
			schema: {
				querystring: GetReportQuerystringRequestSchema,
				response: {
					200: GetReportResponseSchema,
				},
			},
		},
		async (request) => getReport.execute(request.query, request.log),
	);
};

export default music;
