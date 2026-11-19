import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";

import { ArtistsModule } from "./artists/artists.module.js";
import { MediaModule } from "./media/media.module.js";
import { ModelsModule } from "./models/models.module.js";
import { PerformancesModule } from "./performances/performances.module.js";
import { PlacesModule } from "./places/places.module.js";
import { ShowSharedModule } from "./show-shared.module.js";
import { ShowController } from "./show.controller.js";
import { ShowService } from "./show.service.js";
import { SpectaclesModule } from "./spectacles/spectacles.module.js";
import { WorksModule } from "./works/works.module.js";

const CHILDREN = [
	{ path: "artists", module: ArtistsModule },
	{ path: "media", module: MediaModule },
	{ path: "models", module: ModelsModule },
	{ path: "performances", module: PerformancesModule },
	{ path: "places", module: PlacesModule },
	{ path: "spectacles", module: SpectaclesModule },
	{ path: "works", module: WorksModule },
];

@Module({
	imports: [
		ShowSharedModule,
		...CHILDREN.map(({ module }) => module),
		RouterModule.register([{ path: "show", module: ShowModule, children: CHILDREN }]),
	],
	controllers: [ShowController],
	providers: [ShowService],
})
export class ShowModule {}
