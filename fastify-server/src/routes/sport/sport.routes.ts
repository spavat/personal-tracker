import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	CropBodyRequestSchema,
	DeleteParamsRequestSchema,
	DetailsQuerystringRequestSchema,
	DetailsResponseSchema,
	ListQuerystringRequestSchema,
	ListResponseSchema,
	SaveBodyRequestSchema,
	UpdateSegmentsBodyRequestSchema,
} from "@personal-tracker/shared/sport";
import "@fastify/mongodb";

import { GpxStorageRepository } from "./gpx-storage.repository";
import { SportRepository } from "./sport.repository";
import {
	CropActivityUseCase,
	DeleteActivityUseCase,
	DownloadActivityUseCase,
	GetActivityUseCase,
	ImportActivitiesUseCase,
	ListActivitiesUseCase,
	SaveActivityUseCase,
	UpdateSegmentsUseCase,
} from "./sport.useCases";
import { ThumbnailStorageRepository } from "./thumbnail-storage.repository";

const sport: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new SportRepository(fastify.mongo);
	const gpxStorage = new GpxStorageRepository();
	const thumbnailStorage = new ThumbnailStorageRepository();

	const listActivities = new ListActivitiesUseCase(repository);
	const getActivity = new GetActivityUseCase(repository);
	const downloadActivity = new DownloadActivityUseCase(repository, gpxStorage);
	const saveActivity = new SaveActivityUseCase(repository, gpxStorage, thumbnailStorage);
	const deleteActivity = new DeleteActivityUseCase(repository, gpxStorage, thumbnailStorage);
	const importActivities = new ImportActivitiesUseCase(repository, saveActivity, deleteActivity);
	const updateSegments = new UpdateSegmentsUseCase(repository);
	const cropActivity = new CropActivityUseCase(repository, thumbnailStorage);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/list",
		{
			schema: {
				querystring: ListQuerystringRequestSchema,
				response: { 200: ListResponseSchema },
			},
		},
		async (request): Promise<any> => listActivities.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/id",
		{
			schema: {
				querystring: DetailsQuerystringRequestSchema,
				response: { 200: DetailsResponseSchema },
			},
		},
		async (request, reply): Promise<any> =>
			(await getActivity.execute(request.query.id, request.log)) ?? reply.notFound("Activité introuvable"),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/download",
		{
			schema: { querystring: DetailsQuerystringRequestSchema },
		},
		async (request, reply) => {
			const url = await downloadActivity.execute(request.query.id, request.log);
			if (!url) return reply.notFound();
			return reply.redirect(url);
		},
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			bodyLimit: 10 * 1024 * 1024, // 10MB — GPX files can be large
			schema: { body: SaveBodyRequestSchema },
		},
		async (request) => saveActivity.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/:id",
		{
			schema: { params: DeleteParamsRequestSchema },
		},
		async (request) => deleteActivity.execute(request.params.id, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/segments",
		{
			schema: { body: UpdateSegmentsBodyRequestSchema },
		},
		async (request) =>
			updateSegments.execute({ id: request.body.id, segments: request.body.segments }, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/crop",
		{
			schema: { body: CropBodyRequestSchema },
		},
		async (request) =>
			cropActivity.execute(request.body.id, request.body.startIndex, request.body.endIndex, request.log),
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/import", async (request) => importActivities.execute(true, request.log));
};

export default sport;
