import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	SaveBodyRequestSchema,
	DeleteParamsRequestSchema,
	LatestQuerystringRequestSchema,
	LatestParamsRequestSchema,
	LatestEpisodesResponse,
	ExtractQuerystringRequestSchema,
	StatsRequestSchema,
	LatestGenericQuerystringRequestSchema,
	ProgramListQuerystringRequestSchema,
	EpisodeListQuerystringRequestSchema,
	DetailsProgramParamsRequestSchema,
	FortnightStatsResponseSchema,
	StatsArrayResponseSchema,
	SyncResponseSchema,
	SyncUploadBodyRequestSchema,
	SyncProposalParamsRequestSchema,
	SyncDeleteParamsRequestSchema,
	SyncCreateResponseSchema,
	SyncUnknownFeedsResponseSchema,
	SyncFeedBodyRequestSchema,
	SyncLinkFeedBodyRequestSchema,
	SyncReprocessBodyRequestSchema,
} from "@personal-tracker/shared/internet";
import "@fastify/mongodb";

import { ImageStorageRepository } from "./image-storage.repository";
import { InternetRepository } from "./internet.repository";
import {
	DeleteEpisodeUseCase,
	DeleteSyncProposalUseCase,
	ExtractInfoUseCase,
	GetFortnightStatsUseCase,
	GetLatestEpisodesForProgramUseCase,
	GetLatestEpisodesUseCase,
	GetProgramUseCase,
	GetStatsUseCase,
	IgnoreFeedUseCase,
	LinkFeedToProgramUseCase,
	ListEpisodesUseCase,
	ListProgramsUseCase,
	ListSyncProposalsUseCase,
	ListUnknownFeedsUseCase,
	ReprocessSyncProposalsUseCase,
	SaveProgramUseCase,
	SyncCoversUseCase,
	SyncGopodderUseCase,
	UploadAntennaPodUseCase,
	ValidateSyncProposalUseCase,
} from "./internet.useCases";
import { LatestEpisodesCacheRepository } from "./latest-episodes-cache.repository";
import { SyncStateRepository } from "./sync-state.repository";
import { SyncRepository } from "./sync.repository";

const internet: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new InternetRepository(fastify.mongo);
	const latestEpisodesCache = new LatestEpisodesCacheRepository();
	const imageStorage = new ImageStorageRepository();
	const syncRepository = new SyncRepository(fastify.mongo);
	const syncStateRepository = new SyncStateRepository(fastify.mongo);

	const listPrograms = new ListProgramsUseCase(repository, imageStorage);
	const listEpisodes = new ListEpisodesUseCase(repository, imageStorage);
	const extractInfo = new ExtractInfoUseCase(repository);
	const syncCovers = new SyncCoversUseCase(repository, imageStorage);
	const saveProgram = new SaveProgramUseCase(repository, imageStorage);
	const deleteEpisode = new DeleteEpisodeUseCase(repository);
	const getProgram = new GetProgramUseCase(repository, imageStorage);
	const getLatestEpisodes = new GetLatestEpisodesUseCase();
	const getLatestEpisodesForProgram = new GetLatestEpisodesForProgramUseCase(repository, latestEpisodesCache);
	const listSyncProposals = new ListSyncProposalsUseCase(syncRepository);
	const uploadAntennaPod = new UploadAntennaPodUseCase(repository, syncRepository, latestEpisodesCache, imageStorage);
	const reprocessSyncProposals = new ReprocessSyncProposalsUseCase(
		repository,
		syncRepository,
		latestEpisodesCache,
		imageStorage,
	);
	const syncGopodder = new SyncGopodderUseCase(
		repository,
		syncRepository,
		syncStateRepository,
		latestEpisodesCache,
		imageStorage,
	);
	const listUnknownFeeds = new ListUnknownFeedsUseCase(repository, syncRepository);
	const linkFeedToProgram = new LinkFeedToProgramUseCase(repository, reprocessSyncProposals);
	const ignoreFeed = new IgnoreFeedUseCase(syncRepository);
	const validateSyncProposal = new ValidateSyncProposalUseCase(syncRepository, saveProgram);
	const deleteSyncProposal = new DeleteSyncProposalUseCase(syncRepository);
	const getStats = new GetStatsUseCase(repository);
	const getFortnightStats = new GetFortnightStatsUseCase(repository);

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

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/latest",
		{
			schema: { querystring: LatestGenericQuerystringRequestSchema },
		},
		async (request): Promise<LatestEpisodesResponse> => getLatestEpisodes.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/latest/:programId",
		{
			schema: {
				params: LatestParamsRequestSchema,
				querystring: LatestQuerystringRequestSchema,
			},
		},
		async (request): Promise<LatestEpisodesResponse> =>
			getLatestEpisodesForProgram.execute(request.params.programId, request.query.force, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/sync",
		{
			schema: {
				response: {
					200: SyncResponseSchema,
				},
			},
		},
		async (request) => listSyncProposals.execute(request.log),
	);

	// AntennaPod backups are raw SQLite files: accept them as a binary body
	fastify.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_request, body, done) =>
		done(null, body),
	);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/sync/upload",
		{
			bodyLimit: 200 * 1024 * 1024, // 200MB — AntennaPod backups can be large
			schema: { body: SyncUploadBodyRequestSchema },
		},
		async (request) => uploadAntennaPod.execute(request.body, request.log),
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/sync/gopodder", { schema: { response: { 200: SyncCreateResponseSchema } } }, async (request) =>
			syncGopodder.execute(request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get("/sync/feeds", { schema: { response: { 200: SyncUnknownFeedsResponseSchema } } }, async (request) =>
			listUnknownFeeds.execute(request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/sync/feeds/link", { schema: { body: SyncLinkFeedBodyRequestSchema } }, async (request) =>
			linkFeedToProgram.execute(request.body, request.log),
		);

	// POST with a body (not DELETE /:id): the key is a feed URL
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/sync/feeds/ignore", { schema: { body: SyncFeedBodyRequestSchema } }, async (request) =>
			ignoreFeed.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/sync/reprocess", { schema: { body: SyncReprocessBodyRequestSchema } }, async (request) =>
			reprocessSyncProposals.execute(request.body?.rssUrl, request.log),
		);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/sync/validate/:id",
		{
			schema: {
				params: SyncProposalParamsRequestSchema,
				body: SaveBodyRequestSchema,
			},
		},
		async (request) => validateSyncProposal.execute({ id: request.params.id, body: request.body }, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/sync/:id",
		{
			schema: { params: SyncDeleteParamsRequestSchema },
		},
		async (request) => deleteSyncProposal.execute(request.params, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/stats",
		{
			config: { public: true },
			schema: {
				querystring: StatsRequestSchema,
				response: {
					200: StatsArrayResponseSchema,
				},
			},
		},
		async (request) => getStats.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/fortnight-stats",
		{
			config: { public: true },
			schema: {
				response: {
					200: FortnightStatsResponseSchema,
				},
			},
		},
		async (request) => getFortnightStats.execute(request.log),
	);
};

export default internet;
