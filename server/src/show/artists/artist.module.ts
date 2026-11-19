import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { ArtistController } from "./artist.controller.js";
import { ListArtistsUseCase, GetArtistUseCase, SaveArtistUseCase, DeleteArtistUseCase } from "./artist.useCases.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [ArtistController],
	// one provider per use case, injected into the controller
	providers: [ListArtistsUseCase, GetArtistUseCase, SaveArtistUseCase, DeleteArtistUseCase],
})
export class ArtistModule {}
