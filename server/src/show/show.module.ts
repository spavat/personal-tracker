import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";

import { ArtistModule } from "./artists/artist.module.js";
import { MediaModule } from "./media/media.module.js";
import { ModelModule } from "./models/model.module.js";
import { PerformanceModule } from "./performances/performance.module.js";
import { PlaceModule } from "./places/place.module.js";
import { ShowSharedModule } from "./show-shared.module.js";
import { ShowController } from "./show.controller.js";
import { GetReportUseCase, ShowUseCase } from "./show.useCases.js";
import { SpectacleModule } from "./spectacles/spectacle.module.js";
import { WorkModule } from "./works/work.module.js";

const CHILDREN = [
	{ path: "artists", module: ArtistModule },
	{ path: "media", module: MediaModule },
	{ path: "models", module: ModelModule },
	{ path: "performances", module: PerformanceModule },
	{ path: "places", module: PlaceModule },
	{ path: "spectacles", module: SpectacleModule },
	{ path: "works", module: WorkModule },
];

@Module({
	imports: [
		ShowSharedModule,
		...CHILDREN.map(({ module }) => module),
		RouterModule.register([{ path: "show", module: ShowModule, children: CHILDREN }]),
	],
	controllers: [ShowController],
	providers: [ShowUseCase, GetReportUseCase],
})
export class ShowModule {}
