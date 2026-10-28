import { FastifyPluginAsyncZod, ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import {
	BookDetailsParamsSchema,
	BookListRequestSchema,
	DeleteReadingParamsRequestSchema,
	GetReportQuerystringRequestSchema,
	GetReportResponseSchema,
	ReadingParamsRequestSchema,
	SaveBookRequestSchema,
	SaveModelBodyRequestSchema,
	SaveReadingRequestSchema,
} from "@personal-tracker/shared/reading-book";

import { ContextTagRepository } from "../context-tags/context-tag.repository";
import { BookRepository } from "./book.repository";
import {
	AddReadingUseCase,
	DeleteReadingUseCase,
	GetBookUseCase,
	GetReportUseCase,
	ListBooksUseCase,
	SaveBookUseCase,
	SaveModelUseCase,
	SaveReadingUseCase,
} from "./book.useCases";

const readingsBook: FastifyPluginAsyncZod = async (fastify): Promise<void> => {
	const repository = new BookRepository(fastify.mongo);
	const contextTagRepository = new ContextTagRepository(fastify.mongo);
	const listBooks = new ListBooksUseCase(repository);
	const getBook = new GetBookUseCase(repository);
	const saveBook = new SaveBookUseCase(repository);
	const saveModel = new SaveModelUseCase(repository);
	const addReading = new AddReadingUseCase(repository);
	const saveReading = new SaveReadingUseCase(repository);
	const deleteReading = new DeleteReadingUseCase(repository);
	const getReport = new GetReportUseCase(repository, contextTagRepository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/books",
		{
			schema: {
				querystring: BookListRequestSchema,
			},
		},
		async (request) => listBooks.execute(request.query, request.log),
	);
	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/books/:id",
		{
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
		"/books/:id/saveModel",
		{
			schema: {
				body: SaveModelBodyRequestSchema,
				params: ReadingParamsRequestSchema,
			},
		},
		async (request) => saveModel.execute({ bookId: request.params.id, model: request.body }, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/books/:id/readings",
		{
			schema: {
				params: ReadingParamsRequestSchema,
			},
		},
		async (request) => addReading.execute(request.params.id, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/books/:id/saveReading",
		{
			schema: {
				body: SaveReadingRequestSchema,
				params: ReadingParamsRequestSchema,
			},
		},
		async (request) => saveReading.execute({ bookId: request.params.id, reading: request.body }, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/books/:id/readings/:readingId",
		{
			schema: {
				params: DeleteReadingParamsRequestSchema,
			},
		},
		async (request) =>
			deleteReading.execute({ bookId: request.params.id, readingId: request.params.readingId }, request.log),
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
