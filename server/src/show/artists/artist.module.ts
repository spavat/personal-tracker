import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { ArtistController } from "./artist.controller.js";
import { ArtistService } from "./artist.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [ArtistController],
	providers: [ArtistService],
})
export class ArtistModule {}
