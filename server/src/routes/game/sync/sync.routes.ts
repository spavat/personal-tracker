import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import {
	GameImportPreviewResponseSchema,
	GameImportResponseSchema,
	GameMergeBodySchema,
	GameMergeResponseSchema,
	GameReplayResponseSchema,
	GameSyncReplayParamsSchema,
	GameSyncRunBodySchema,
	GameSyncRunResponseSchema,
	GameSyncStatusResponseSchema,
	GameSyncStoreParamsSchema,
} from "@personal-tracker/shared/game";
import "@fastify/mongodb";

import { buildSyncContext } from "./sync-context";
import {
	ConfirmImportUseCase,
	GetSyncStatusUseCase,
	MergeGamesUseCase,
	PreviewImportUseCase,
	ReplayUseCase,
	RunDailySyncUseCase,
} from "./sync.useCases";

// Store playtime sync (/game/sync); the daily run is also started by jobs/game-store-sync.job.ts
const sync: FastifyPluginAsync = async (fastify): Promise<void> => {
	const context = buildSyncContext(fastify.mongo);
	const { connectors, games, snapshots } = context;
	const getStatus = new GetSyncStatusUseCase(context);
	const previewImport = new PreviewImportUseCase(connectors, games, { enrichment: context.enrichment });
	const confirmImport = new ConfirmImportUseCase(connectors, games, snapshots, { enrichment: context.enrichment });
	const runSync = new RunDailySyncUseCase(connectors, games, snapshots, { enrichment: context.enrichment });
	const replay = new ReplayUseCase(connectors, games, snapshots);
	const mergeGames = new MergeGamesUseCase(games);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.get("/status", { schema: { response: { 200: GameSyncStatusResponseSchema } } }, async (request) =>
			getStatus.execute(request.log),
		);

	// POST: fetches the store (no write, but not a cheap read either)
	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/import/:store/preview",
			{ schema: { params: GameSyncStoreParamsSchema, response: { 200: GameImportPreviewResponseSchema } } },
			async (request) => previewImport.execute(request.params.store, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/import/:store",
			{ schema: { params: GameSyncStoreParamsSchema, response: { 200: GameImportResponseSchema } } },
			async (request) => confirmImport.execute(request.params.store, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/run",
			{ schema: { body: GameSyncRunBodySchema, response: { 200: GameSyncRunResponseSchema } } },
			async (request) => runSync.execute(request.body?.store, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/replay/:store/:day",
			{ schema: { params: GameSyncReplayParamsSchema, response: { 200: GameReplayResponseSchema } } },
			async (request) => replay.execute(request.params.store, request.params.day, request.log),
		);

	fastify
		.withTypeProvider<ZodTypeProvider>()
		.post(
			"/merge",
			{ schema: { body: GameMergeBodySchema, response: { 200: GameMergeResponseSchema } } },
			async (request, reply) => {
				return (await mergeGames.execute(request.body, request.log)) ?? reply.notFound("Jeu introuvable");
			},
		);
};

export default sync;
