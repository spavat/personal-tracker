import { FastifyPluginAsyncZod, ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import { DeleteReadingParamsRequestSchema } from "@personal-tracker/shared/reading-book";
import {
	SaveBodyRequestSchema,
	MangaListRequestSchema,
	MangaDetailsParamsSchema,
} from "@personal-tracker/shared/reading-manga";

import { MangaRepository } from "./manga.repository";
import { DeleteReadingUseCase, GetMangaUseCase, ListMangasUseCase, SaveMangaUseCase } from "./manga.useCases";

const readingsManga: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
	const repository = new MangaRepository(fastify.mongo);
	const listMangas = new ListMangasUseCase(repository);
	const getManga = new GetMangaUseCase(repository);
	const saveManga = new SaveMangaUseCase(repository);
	const deleteReading = new DeleteReadingUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/mangas",
		{
			schema: {
				querystring: MangaListRequestSchema,
			},
		},
		async (request) => listMangas.execute(request.query, request.log),
	);
	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/mangas/:id",
		{
			schema: { params: MangaDetailsParamsSchema },
		},
		async (request, reply) =>
			(await getManga.execute(request.params.id, request.log)) ?? reply.notFound("Manga introuvable"),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: { body: SaveBodyRequestSchema },
		},
		async (request) => saveManga.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/mangas/:id/readings/:readingId",
		{
			schema: {
				params: DeleteReadingParamsRequestSchema,
			},
		},
		async (request) =>
			deleteReading.execute({ mangaId: request.params.id, readingId: request.params.readingId }, request.log),
	);
};

export default readingsManga;
