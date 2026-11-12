import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	SaveBodyRequestSchema,
	SyncCreateResponseSchema,
	SyncDeleteParamsRequestSchema,
	SyncFeedBodyRequestSchema,
	SyncGopodderStatusResponseSchema,
	SyncLinkFeedBodyRequestSchema,
	SyncProposalParamsRequestSchema,
	SyncReprocessBodyRequestSchema,
	SyncResponseSchema,
	SyncUnknownFeedsResponseSchema,
	SyncUploadBodyRequestSchema,
} from "@personal-tracker/shared/internet";
import "@fastify/mongodb";

import { ImageStorageRepository } from "../image-storage.repository";
import { InternetRepository } from "../internet.repository";
import { SaveProgramUseCase } from "../internet.useCases";
import { latestEpisodesCache } from "../latest-episodes-cache.repository";
import { SyncStateRepository } from "./sync-state.repository";
import { SyncRepository } from "./sync.repository";
import {
	DeleteSyncProposalUseCase,
	GetGopodderStatusUseCase,
	IgnoreFeedUseCase,
	LinkFeedToProgramUseCase,
	ListSyncProposalsUseCase,
	ListUnknownFeedsUseCase,
	ReprocessSyncProposalsUseCase,
	SyncGopodderUseCase,
	UploadAntennaPodUseCase,
	ValidateSyncProposalUseCase,
} from "./sync.useCases";

const sync: FastifyPluginAsync = async (fastify): Promise<void> => {
	const repository = new InternetRepository(fastify.mongo);
	const imageStorage = new ImageStorageRepository();
	const syncRepository = new SyncRepository(fastify.mongo);
	const syncStateRepository = new SyncStateRepository(fastify.mongo);

	const saveProgram = new SaveProgramUseCase(repository, imageStorage);
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
	const getGopodderStatus = new GetGopodderStatusUseCase(syncStateRepository);
	const listUnknownFeeds = new ListUnknownFeedsUseCase(repository, syncRepository);
	const linkFeedToProgram = new LinkFeedToProgramUseCase(repository, reprocessSyncProposals);
	const ignoreFeed = new IgnoreFeedUseCase(syncRepository);
	const validateSyncProposal = new ValidateSyncProposalUseCase(syncRepository, saveProgram);
	const deleteSyncProposal = new DeleteSyncProposalUseCase(syncRepository);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/",
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
		"/upload",
		{
			bodyLimit: 200 * 1024 * 1024, // 200MB — AntennaPod backups can be large
			schema: { body: SyncUploadBodyRequestSchema },
		},
		async (request) => uploadAntennaPod.execute(request.body, request.log),
	);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get("/gopodder", { schema: { response: { 200: SyncGopodderStatusResponseSchema } } }, async (request) =>
			getGopodderStatus.execute(request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/gopodder", { schema: { response: { 200: SyncCreateResponseSchema } } }, async (request) =>
			syncGopodder.execute(request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get("/feeds", { schema: { response: { 200: SyncUnknownFeedsResponseSchema } } }, async (request) =>
			listUnknownFeeds.execute(request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/feeds/link", { schema: { body: SyncLinkFeedBodyRequestSchema } }, async (request) =>
			linkFeedToProgram.execute(request.body, request.log),
		);

	// POST with a body (not DELETE /:id): the key is a feed URL
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/feeds/ignore", { schema: { body: SyncFeedBodyRequestSchema } }, async (request) =>
			ignoreFeed.execute(request.body, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post("/reprocess", { schema: { body: SyncReprocessBodyRequestSchema } }, async (request) =>
			reprocessSyncProposals.execute(request.body?.rssUrl, request.log),
		);

	fastify.withTypeProvider<ZodTypeProvider>().post(
		"/validate/:id",
		{
			schema: {
				params: SyncProposalParamsRequestSchema,
				body: SaveBodyRequestSchema,
			},
		},
		async (request) => validateSyncProposal.execute({ id: request.params.id, body: request.body }, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().delete(
		"/:id",
		{
			schema: { params: SyncDeleteParamsRequestSchema },
		},
		async (request) => deleteSyncProposal.execute(request.params, request.log),
	);
};

export default sync;
