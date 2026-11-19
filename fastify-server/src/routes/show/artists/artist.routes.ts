import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	ArtistDetailsParamsRequestSchema,
	ArtistDetailsQuerystringRequestSchema,
	ArtistListQuerystringRequestSchema,
	ArtistViewSchema,
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
			config: { public: true },
			schema: { querystring: ArtistListQuerystringRequestSchema },
		},
		async (request): Promise<any> => listArtists.execute(request.query.sort, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/:id",
		{
			config: { public: true },
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

	// 201 with the new artist on create, 200 with the updated one on update
	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: {
				body: SaveArtistBodyRequestSchema,
				response: { 200: ArtistViewSchema, 201: ArtistViewSchema },
			},
		},
		async (request, reply) => {
			const artist = await saveArtist.execute(request.body, request.log);
			if (!artist) {
				return reply.notFound("Artiste introuvable");
			}
			return reply.code(request.body.id ? 200 : 201).send(artist);
		},
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.delete("/:id", { schema: { params: DeleteArtistParamsRequestSchema } }, async (request, reply) => {
			await deleteArtist.execute(request.params.id, request.log);
			return reply.code(204).send();
		});
};

export default artistsRoutes;
