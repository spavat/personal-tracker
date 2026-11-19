import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ArtistsRepository } from "./artists/artists.repository.js";
import { MediaStorageRepository } from "./media/media-storage.repository.js";
import { MediaRepository } from "./media/media.repository.js";
import { ModelsRepository } from "./models/models.repository.js";
import { PerformancesRepository } from "./performances/performances.repository.js";
import { PlacesRepository } from "./places/places.repository.js";
import { SpectaclesRepository } from "./spectacles/spectacles.repository.js";
import { WorksRepository } from "./works/works.repository.js";

// The repositories of every show sub-domain: some services read several (a performance deletes its media,
// the search reads spectacles, artists and places). Its own module so the sub-modules don't import their parent.
const REPOSITORIES = [
	ArtistsRepository,
	MediaRepository,
	MediaStorageRepository,
	ModelsRepository,
	PerformancesRepository,
	PlacesRepository,
	SpectaclesRepository,
	WorksRepository,
];

@Module({
	imports: [DatabaseModule, StorageModule],
	providers: REPOSITORIES,
	exports: REPOSITORIES,
})
export class ShowSharedModule {}
