import { FastifyPluginAsyncZod, ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import {
	AuthorListResponseSchema,
	AuthorParamsRequestSchema,
	BookDetailsParamsSchema,
	BookListRequestSchema,
	DeleteReadingParamsRequestSchema,
	EditionParamsRequestSchema,
	GetReportQuerystringRequestSchema,
	GetReportResponseSchema,
	ModelParamsRequestSchema,
	ReadingParamsRequestSchema,
	SaveBookModelRequestSchema,
	SaveBookRequestSchema,
	SaveEditionRequestSchema,
	SaveReadingRequestSchema,
	SaveSeriesRequestSchema,
	SeriesListResponseSchema,
	SeriesParamsRequestSchema,
} from "@personal-tracker/shared/reading-book";

import { ContextTagRepository } from "../context-tags/context-tag.repository";
import { BookRepository } from "./book.repository";
import {
	AddReadingUseCase,
	DeleteEditionUseCase,
	DeleteModelUseCase,
	DeleteReadingUseCase,
	DeleteSeriesUseCase,
	GetAuthorUseCase,
	GetBookUseCase,
	GetReportUseCase,
	GetSeriesUseCase,
	ListAuthorsUseCase,
	ListBooksUseCase,
	ListSeriesUseCase,
	SaveBookUseCase,
	SaveEditionUseCase,
	SaveModelUseCase,
	SaveReadingUseCase,
	SaveSeriesUseCase,
} from "./book.useCases";
import { CoverStorageRepository } from "./cover-storage.repository";

const COVER_BODY_LIMIT = 15 * 1024 * 1024; // 15MB — the cover can be sent as a base64 data URI

const readingsBook: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
	const repository = new BookRepository(fastify.db);
	const contextTagRepository = new ContextTagRepository(fastify.mongo);
	const covers = new CoverStorageRepository();
	const listBooks = new ListBooksUseCase(repository);
	const getBook = new GetBookUseCase(repository);
	const saveBook = new SaveBookUseCase(repository);
	const saveModel = new SaveModelUseCase(repository);
	const deleteModel = new DeleteModelUseCase(repository);
	const saveEdition = new SaveEditionUseCase(repository, covers);
	const deleteEdition = new DeleteEditionUseCase(repository, covers);
	const addReading = new AddReadingUseCase(repository);
	const saveReading = new SaveReadingUseCase(repository);
	const deleteReading = new DeleteReadingUseCase(repository);
	const getReport = new GetReportUseCase(repository, contextTagRepository);
	const listSeries = new ListSeriesUseCase(repository);
	const getSeries = new GetSeriesUseCase(repository);
	const saveSeries = new SaveSeriesUseCase(repository);
	const deleteSeries = new DeleteSeriesUseCase(repository);

	// public, like the books
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/series",
			{ config: { public: true }, schema: { response: { 200: SeriesListResponseSchema } } },
			async (request) => listSeries.execute(request.log),
		);
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/series/:id",
			{ config: { public: true }, schema: { params: SeriesParamsRequestSchema } },
			async (request, reply) =>
				(await getSeries.execute(request.params.id, request.log)) ?? reply.notFound("Série introuvable"),
		);
	// 201 on create, 200 on update, with the series' id
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/series/save", { schema: { body: SaveSeriesRequestSchema } }, async (request, reply) => {
			const saved = await saveSeries.execute(request.body, request.log);
			return reply.code(request.body.id ? 200 : 201).send(saved);
		});
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/series/:id", { schema: { params: SeriesParamsRequestSchema } }, async (request, reply) => {
			await deleteSeries.execute(request.params.id, request.log);
			return reply.code(204).send();
		});

	const listAuthors = new ListAuthorsUseCase(repository);
	const getAuthor = new GetAuthorUseCase(repository);

	// public, like the books
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/authors",
			{ config: { public: true }, schema: { response: { 200: AuthorListResponseSchema } } },
			async (request) => listAuthors.execute(request.log),
		);
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get(
			"/authors/:id",
			{ config: { public: true }, schema: { params: AuthorParamsRequestSchema } },
			async (request, reply) =>
				(await getAuthor.execute(request.params.id, request.log)) ?? reply.notFound("Auteur·ice introuvable"),
		);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/books",
		{
			config: { public: true },
			schema: {
				querystring: BookListRequestSchema,
			},
		},
		async (request) => listBooks.execute(request.query, request.log),
	);
	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/books/:id",
		{
			config: { public: true },
			schema: {
				params: BookDetailsParamsSchema,
			},
		},
		async (request, reply) =>
			(await getBook.execute(request.params.id, request.log)) ?? reply.notFound("Livre introuvable"),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SaveBookRequestSchema,
			},
		},
		async (request) => saveBook.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/books/:id/models/save",
		{
			schema: {
				body: SaveBookModelRequestSchema,
				params: ReadingParamsRequestSchema,
			},
		},
		async (request, reply) => {
			await saveModel.execute({ bookId: request.params.id, model: request.body }, request.log);
			return reply.code(204).send();
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/books/:id/models/:modelId",
		{
			schema: {
				params: ModelParamsRequestSchema,
			},
		},
		async (request, reply) => {
			await deleteModel.execute({ bookId: request.params.id, modelId: request.params.modelId }, request.log);
			return reply.code(204).send();
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/books/:id/editions/save",
		{
			bodyLimit: COVER_BODY_LIMIT,
			schema: {
				body: SaveEditionRequestSchema,
				params: ReadingParamsRequestSchema,
			},
		},
		async (request, reply) => {
			await saveEdition.execute({ bookId: request.params.id, edition: request.body }, request.log);
			return reply.code(204).send();
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/books/:id/editions/:editionId",
		{
			schema: {
				params: EditionParamsRequestSchema,
			},
		},
		async (request, reply) => {
			await deleteEdition.execute(
				{ bookId: request.params.id, editionId: request.params.editionId },
				request.log,
			);
			return reply.code(204).send();
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/books/:id/editions/:editionId/readings",
		{
			schema: {
				params: EditionParamsRequestSchema,
			},
		},
		async (request, reply) => {
			await addReading.execute({ bookId: request.params.id, editionId: request.params.editionId }, request.log);
			return reply.code(204).send();
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/books/:id/saveReading",
		{
			schema: {
				body: SaveReadingRequestSchema,
				params: ReadingParamsRequestSchema,
			},
		},
		async (request, reply) => {
			await saveReading.execute({ bookId: request.params.id, reading: request.body }, request.log);
			return reply.code(204).send();
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/books/:id/readings/:readingId",
		{
			schema: {
				params: DeleteReadingParamsRequestSchema,
			},
		},
		async (request, reply) => {
			await deleteReading.execute(
				{ bookId: request.params.id, readingId: request.params.readingId },
				request.log,
			);
			return reply.code(204).send();
		},
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

export default readingsBook;
