import type { z } from "zod";

import { Body, Controller, Get, HttpCode, Param, Post, SerializeOptions } from "@nestjs/common";
import {
	type GameMergeBody,
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
	type GameStore,
} from "@personal-tracker/shared/game";

import { GameSyncService } from "./game-sync.service.js";

// Store playtime sync (/game/sync); the daily run is started by GameSyncJob
@Controller()
export class GameSyncController {
	constructor(private readonly service: GameSyncService) {}

	@Get("status")
	@SerializeOptions({ schema: GameSyncStatusResponseSchema })
	status() {
		return this.service.status();
	}

	// POST: fetches the store (no write, but not a cheap read either)
	@Post("import/:store/preview")
	@HttpCode(200)
	@SerializeOptions({ schema: GameImportPreviewResponseSchema.element })
	preview(@Param({ schema: GameSyncStoreParamsSchema }) { store }: { store: GameStore }) {
		return this.service.preview(store);
	}

	@Post("import/:store")
	@HttpCode(200)
	@SerializeOptions({ schema: GameImportResponseSchema })
	import(@Param({ schema: GameSyncStoreParamsSchema }) { store }: { store: GameStore }) {
		return this.service.import(store);
	}

	@Post("run")
	@HttpCode(200)
	@SerializeOptions({ schema: GameSyncRunResponseSchema.element })
	run(@Body({ schema: GameSyncRunBodySchema }) body: z.infer<typeof GameSyncRunBodySchema>) {
		return this.service.run(body?.store);
	}

	@Post("replay/:store/:day")
	@HttpCode(200)
	@SerializeOptions({ schema: GameReplayResponseSchema })
	replay(@Param({ schema: GameSyncReplayParamsSchema }) { store, day }: { store: GameStore; day: string }) {
		return this.service.replay(store, day);
	}

	@Post("merge")
	@HttpCode(200)
	@SerializeOptions({ schema: GameMergeResponseSchema })
	merge(@Body({ schema: GameMergeBodySchema }) body: GameMergeBody) {
		return this.service.merge(body);
	}
}
