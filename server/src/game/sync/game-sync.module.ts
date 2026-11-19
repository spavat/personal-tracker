import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { GameSharedModule } from "../game-shared.module.js";
import { CredentialRepository } from "./credential.repository.js";
import { GameSyncController } from "./game-sync.controller.js";
import { GameSyncJob } from "./game-sync.job.js";
import { GameSyncService } from "./game-sync.service.js";
import { SnapshotRepository } from "./snapshot.repository.js";
import { SteamStore } from "./steam-store.js";
import { storeConnectorsProvider } from "./store-connectors.js";

@Module({
	imports: [DatabaseModule, GameSharedModule],
	controllers: [GameSyncController],
	providers: [
		GameSyncService,
		GameSyncJob,
		SnapshotRepository,
		CredentialRepository,
		storeConnectorsProvider,
		// its constructor's optional `wait` parameter is not a dependency to inject
		{ provide: SteamStore, useFactory: () => new SteamStore() },
	],
})
export class GameSyncModule {}
