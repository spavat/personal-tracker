import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { ArtistsController } from "./artists.controller.js";
import { ArtistsService } from "./artists.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [ArtistsController],
	providers: [ArtistsService],
})
export class ArtistsModule {}
