import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import { SearchQuerystringRequestSchema } from "@shared/dist/schemas/music.schema";
import { GetReportQuerystringRequestSchema, GetReportResponseSchema } from "@shared/dist/schemas/show.schema";

import { ArtistRepository } from "./artists/artist.repository";
import { PerformanceRepository } from "./performances/performance.repository";
import { PlaceRepository } from "./places/place.repository";
import { GetReportUseCase, ShowUseCase } from "./show.useCases";
import { SpectacleRepository } from "./spectacles/spectacle.repository";

const showRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const spectacleRepository = new SpectacleRepository(fastify.db);
	const artistRepository = new ArtistRepository(fastify.db);
	const placeRepository = new PlaceRepository(fastify.db);
	const performanceRepository = new PerformanceRepository(fastify.db);
	const searchShow = new ShowUseCase(spectacleRepository, artistRepository, placeRepository);
	const getReport = new GetReportUseCase(performanceRepository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/search",
		{
			schema: { querystring: SearchQuerystringRequestSchema },
		},
		async (request): Promise<any> => searchShow.execute(request.query.search ?? "", request.log),
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
		async (request): Promise<any> => getReport.execute(request.query, request.log),
	);
};

export default showRoutes;
