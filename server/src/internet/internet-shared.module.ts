import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { InternetImagesStorage } from "./internet-images.storage.js";
import { InternetRepository } from "./internet.repository.js";
import { InternetService } from "./internet.service.js";
import { LatestEpisodesCache } from "./latest-episodes.cache.js";

// What the internet root routes and the latest / review / stats / sync sub-modules share.
// Its own module (not InternetModule) so the sub-modules can import it without importing their parent.
@Module({
	imports: [DatabaseModule, StorageModule],
	providers: [InternetRepository, InternetImagesStorage, InternetService, LatestEpisodesCache],
	exports: [InternetRepository, InternetImagesStorage, InternetService, LatestEpisodesCache],
})
export class InternetSharedModule {}
