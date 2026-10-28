import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	DeletePlaceParamsRequestSchema,
	PlaceDetailsParamsRequestSchema,
	PlaceDetailsQuerystringRequestSchema,
	PlaceListQuerystringRequestSchema,
	SavePlaceBodyRequestSchema,
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

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/save", { schema: { body: SavePlaceBodyRequestSchema } }, async (request) =>
			savePlace.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeletePlaceParamsRequestSchema } }, async (request) =>
			deletePlace.execute(request.params.id, request.log),
		);
};

export default placesRoutes;
