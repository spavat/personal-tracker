import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ArtistRepository } from "./artists/artist.repository.js";
import { MediaStorageRepository } from "./media/media-storage.repository.js";
import { MediaRepository } from "./media/media.repository.js";
import { ModelRepository } from "./models/model.repository.js";
import { PerformanceRepository } from "./performances/performance.repository.js";
import { PlaceRepository } from "./places/place.repository.js";
import { SpectacleRepository } from "./spectacles/spectacle.repository.js";
import { WorkRepository } from "./works/work.repository.js";

// The repositories of every show sub-domain: some use cases read several (a performance deletes its media,
// the search reads spectacles, artists and places). Its own module so the sub-modules don't import their parent.
const REPOSITORIES = [
	ArtistRepository,
	MediaRepository,
	MediaStorageRepository,
	ModelRepository,
	PerformanceRepository,
	PlaceRepository,
	SpectacleRepository,
	WorkRepository,
];

@Module({
	imports: [DatabaseModule, StorageModule],
	providers: REPOSITORIES,
	exports: REPOSITORIES,
})
export class ShowSharedModule {}
