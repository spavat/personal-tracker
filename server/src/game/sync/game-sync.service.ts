import type { GameMergeBody, GameStore } from "@personal-tracker/shared/game";

import { Inject, Injectable, Logger } from "@nestjs/common";

import type { StoreConnector } from "./connector.js";

import { GameImagesStorage } from "../game-images.storage.js";
import { GameRepository } from "../game.repository.js";
import { CredentialRepository } from "./credential.repository.js";
import { SnapshotRepository } from "./snapshot.repository.js";
import { SteamStore } from "./steam-store.js";
import { STORE_CONNECTORS } from "./store-connectors.js";
import { toSyncLog } from "./sync-log.js";
import {
	ConfirmImportUseCase,
	GetSyncStatusUseCase,
	MergeGamesUseCase,
	PreviewImportUseCase,
	ReplayUseCase,
	RunDailySyncUseCase,
} from "./sync.useCases.js";

/**
 * Store playtime sync, used by the /game/sync routes and the daily job. The rules live in framework-free use
 * cases (sync.useCases.ts, tested with in-memory repositories); this provider wires them to the injected ones.
 */
@Injectable()
export class GameSyncService {
	private readonly log = toSyncLog(new Logger(GameSyncService.name));
	private readonly previewImport: PreviewImportUseCase;
	private readonly confirmImport: ConfirmImportUseCase;
	private readonly runSync: RunDailySyncUseCase;
	private readonly replayDay: ReplayUseCase;
	private readonly mergeGames: MergeGamesUseCase;
	private readonly getStatus: GetSyncStatusUseCase;

	constructor(
		@Inject(STORE_CONNECTORS) connectors: StoreConnector[],
		games: GameRepository,
		snapshots: SnapshotRepository,
		credentials: CredentialRepository,
		steam: SteamStore,
		images: GameImagesStorage,
	) {
		// Steam info and pictures of the games created or linked
		const options = { enrichment: { steam, images } };
		this.previewImport = new PreviewImportUseCase(connectors, games, options);
		this.confirmImport = new ConfirmImportUseCase(connectors, games, snapshots, options);
		this.runSync = new RunDailySyncUseCase(connectors, games, snapshots, options);
		this.replayDay = new ReplayUseCase(connectors, games, snapshots);
		this.mergeGames = new MergeGamesUseCase(games);
		this.getStatus = new GetSyncStatusUseCase({ connectors, games, snapshots, credentials });
	}

	status() {
		return this.getStatus.execute(this.log);
	}

	preview(store: GameStore) {
		return this.previewImport.execute(store, this.log);
	}

	import(store: GameStore) {
		return this.confirmImport.execute(store, this.log);
	}

	// every configured store, or only `store`
	run(store?: GameStore) {
		return this.runSync.execute(store, this.log);
	}

	replay(store: GameStore, day: string) {
		return this.replayDay.execute(store, day, this.log);
	}

	merge(body: GameMergeBody) {
		return this.mergeGames.execute(body, this.log);
	}
}
