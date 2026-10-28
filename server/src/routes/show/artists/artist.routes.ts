import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	ArtistDetailsParamsRequestSchema,
	ArtistDetailsQuerystringRequestSchema,
	ArtistListQuerystringRequestSchema,
	DeleteArtistParamsRequestSchema,
	SaveArtistBodyRequestSchema,
} from "@personal-tracker/shared/show";

import { ArtistRepository } from "./artist.repository";
import { DeleteArtistUseCase, GetArtistUseCase, ListArtistsUseCase, SaveArtistUseCase } from "./artist.useCases";

const artistsRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new ArtistRepository(fastify.db);
	const listArtists = new ListArtistsUseCase(repository);
	const getArtist = new GetArtistUseCase(repository);
	const saveArtist = new SaveArtistUseCase(repository);
	const deleteArtist = new DeleteArtistUseCase(repository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
		{
			schema: { querystring: ArtistListQuerystringRequestSchema },
		},
		async (request): Promise<any> => listArtists.execute(request.query.sort, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			schema: {
				params: ArtistDetailsParamsRequestSchema,
				querystring: ArtistDetailsQuerystringRequestSchema,
			},
		},
		async (request, reply): Promise<any> =>
			(await getArtist.execute(
				{ artistId: request.params.id, groupBySpectacle: request.query.groupBySpectacle },
				request.log,
			)) ?? reply.notFound("Artiste introuvable"),
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/save", { schema: { body: SaveArtistBodyRequestSchema } }, async (request) =>
			saveArtist.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeleteArtistParamsRequestSchema } }, async (request) =>
			deleteArtist.execute(request.params.id, request.log),
		);
};

export default artistsRoutes;
