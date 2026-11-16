import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	SaveBodyRequestSchema,
	DeleteParamsRequestSchema,
	ExtractQuerystringRequestSchema,
	ProgramListQuerystringRequestSchema,
	EpisodeListQuerystringRequestSchema,
	DetailsProgramParamsRequestSchema,
} from "@personal-tracker/shared/internet";
import "@fastify/mongodb";

import { ImageStorageRepository } from "./image-storage.repository";
import { InternetRepository } from "./internet.repository";
import {
	DeleteEpisodeUseCase,
	ExtractInfoUseCase,
	GetProgramUseCase,
	ListEpisodesUseCase,
	ListProgramsUseCase,
	SaveProgramUseCase,
	SyncCoversUseCase,
} from "./internet.useCases";

// Sub-domains live in their own folders (and URL prefixes): latest/, stats/, sync/
const internet: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new InternetRepository(fastify.mongo);
	const imageStorage = new ImageStorageRepository();

	const listPrograms = new ListProgramsUseCase(repository, imageStorage);
	const listEpisodes = new ListEpisodesUseCase(repository, imageStorage);
	const extractInfo = new ExtractInfoUseCase(repository);
	const syncCovers = new SyncCoversUseCase(repository, imageStorage);
	const saveProgram = new SaveProgramUseCase(repository, imageStorage);
	const deleteEpisode = new DeleteEpisodeUseCase(repository);
	const getProgram = new GetProgramUseCase(repository, imageStorage);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/programs",
		{
			config: { public: true },
			schema: { querystring: ProgramListQuerystringRequestSchema },
		},
		async (request): Promise<any> => listPrograms.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/episodes",
		{
			config: { public: true },
			schema: { querystring: EpisodeListQuerystringRequestSchema },
		},
		async (request) => listEpisodes.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/extract",
		{
			schema: { querystring: ExtractQuerystringRequestSchema },
		},
		async (request) => extractInfo.execute(request.query, request.log),
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/sync-covers", async (request) => syncCovers.execute(request.log));

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/save",
		{
			schema: { body: SaveBodyRequestSchema },
		},
		async (request) => saveProgram.execute(request.body, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/programs/:programId/episodes/:episodeId",
		{
			schema: { params: DeleteParamsRequestSchema },
		},
		async (request) => deleteEpisode.execute(request.params, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/id/:programId",
		{
			config: { public: true },
			schema: {
				params: DetailsProgramParamsRequestSchema,
			},
		},
		async (request, reply) =>
			(await getProgram.execute(request.params.programId, request.log)) ??
			reply.notFound("Programme introuvable"),
	);
};

export default internet;
