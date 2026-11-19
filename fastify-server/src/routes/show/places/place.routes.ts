import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	DeletePlaceParamsRequestSchema,
	PlaceDetailsParamsRequestSchema,
	PlaceDetailsQuerystringRequestSchema,
	PlaceListQuerystringRequestSchema,
	SavePlaceBodyRequestSchema,
	SavePlaceResponseSchema,
} from "@personal-tracker/shared/show";

import { PlaceRepository } from "./place.repository";
import { DeletePlaceUseCase, GetPlaceUseCase, ListPlacesUseCase, SavePlaceUseCase } from "./place.useCases";

const placesRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new PlaceRepository(fastify.db);
	const listPlaces = new ListPlacesUseCase(repository);
	const getPlace = new GetPlaceUseCase(repository);
	const savePlace = new SavePlaceUseCase(repository);
	const deletePlace = new DeletePlaceUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			config: { public: true },
			schema: { querystring: PlaceListQuerystringRequestSchema },
		},
		async (request): Promise<any> => listPlaces.execute(request.query.sort, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			config: { public: true },
			schema: { params: PlaceDetailsParamsRequestSchema, querystring: PlaceDetailsQuerystringRequestSchema },
		},
		async (request, reply): Promise<any> =>
			(await getPlace.execute(
				{ placeId: request.params.id, groupBySpectacle: Boolean(request.query.groupBySpectacle) },
				request.log,
			)) ?? reply.notFound("Salle introuvable"),
	);

	// 201 with the new place on create, 200 with the updated one on update
	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SavePlaceBodyRequestSchema,
				response: { 200: SavePlaceResponseSchema, 201: SavePlaceResponseSchema },
			},
		},
		async (request, reply) => {
			const place = await savePlace.execute(request.body, request.log);
			if (!place) {
				return reply.notFound("Salle introuvable");
			}
			return reply.code(request.body.id ? 200 : 201).send(place);
		},
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeletePlaceParamsRequestSchema } }, async (request, reply) => {
			await deletePlace.execute(request.params.id, request.log);
			return reply.code(204).send();
		});
};

export default placesRoutes;
