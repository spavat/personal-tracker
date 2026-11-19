import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { PlaceController } from "./place.controller.js";
import { PlaceService } from "./place.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [PlaceController],
	providers: [PlaceService],
})
export class PlaceModule {}
