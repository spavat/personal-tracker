import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	LifespanEventDeleteParamsRequestSchema,
	LifespanObjectDeleteParamsRequestSchema,
	LifespanObjectDetailsParamsRequestSchema,
	LifespanObjectListQuerystringRequestSchema,
	LifespanObjectSaveBodyRequestSchema,
} from "@personal-tracker/shared/lifespan";
import "@fastify/mongodb";

import { LifespanObjectRepository } from "./object.repository";
import {
	DeleteLifespanEventUseCase,
	DeleteLifespanObjectUseCase,
	GetLifespanObjectUseCase,
	ListLifespanObjectsUseCase,
	SaveLifespanObjectUseCase,
} from "./object.useCases";

const lifespanObjects: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new LifespanObjectRepository(fastify.mongo);
	const listObjects = new ListLifespanObjectsUseCase(repository);
	const getObject = new GetLifespanObjectUseCase(repository);
	const saveObject = new SaveLifespanObjectUseCase(repository);
	const deleteEvent = new DeleteLifespanEventUseCase(repository);
	const deleteObject = new DeleteLifespanObjectUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			schema: { querystring: LifespanObjectListQuerystringRequestSchema },
		},
		async (request): Promise<any> => listObjects.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			schema: { params: LifespanObjectDetailsParamsRequestSchema },
		},
		async (request, reply) =>
			(await getObject.execute(request.params.id, request.log)) ?? reply.notFound("Objet introuvable"),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: { body: LifespanObjectSaveBodyRequestSchema },
		},
		async (request) => saveObject.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/:objectId/events/:eventId",
		{
			schema: { params: LifespanEventDeleteParamsRequestSchema },
		},
		async (request) => deleteEvent.execute(request.params, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/:id",
		{
			schema: { params: LifespanObjectDeleteParamsRequestSchema },
		},
		async (request) => deleteObject.execute(request.params.id, request.log),
	);
};

export default lifespanObjects;
