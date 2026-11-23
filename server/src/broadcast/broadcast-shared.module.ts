import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { BroadcastImagesStorage } from "./broadcast-images.storage.js";
import { BroadcastRepository } from "./broadcast.repository.js";
import { BroadcastService } from "./broadcast.service.js";
import { LatestEpisodesCache } from "./latest-episodes.cache.js";

// What the broadcast root routes and the latest / review / stats / sync sub-modules share.
// Its own module (not BroadcastModule) so the sub-modules can import it without importing their parent.
@Module({
	imports: [DatabaseModule, StorageModule],
	providers: [BroadcastRepository, BroadcastImagesStorage, BroadcastService, LatestEpisodesCache],
	exports: [BroadcastRepository, BroadcastImagesStorage, BroadcastService, LatestEpisodesCache],
})
export class BroadcastSharedModule {}
