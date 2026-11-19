import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { PlaceController } from "./place.controller.js";
import { DeletePlaceUseCase, GetPlaceUseCase, ListPlacesUseCase, SavePlaceUseCase } from "./place.useCases.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [PlaceController],
	providers: [ListPlacesUseCase, GetPlaceUseCase, SavePlaceUseCase, DeletePlaceUseCase],
})
export class PlaceModule {}
