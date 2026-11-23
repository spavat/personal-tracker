import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { BroadcastSharedModule } from "../broadcast-shared.module.js";
import { GopodderClient } from "./gopodder.client.js";
import { SyncStateRepository } from "./sync-state.repository.js";
import { SyncController } from "./sync.controller.js";
import { SyncRepository } from "./sync.repository.js";
import { SyncService } from "./sync.service.js";

@Module({
	// DatabaseModule as well: BroadcastSharedModule imports it but does not re-export it (MONGO_DB for the sync repositories)
	imports: [DatabaseModule, BroadcastSharedModule],
	controllers: [SyncController],
	providers: [SyncService, SyncRepository, SyncStateRepository, GopodderClient],
})
export class SyncModule {}
