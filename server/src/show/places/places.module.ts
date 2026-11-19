import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { PlacesController } from "./places.controller.js";
import { PlacesService } from "./places.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [PlacesController],
	providers: [PlacesService],
})
export class PlacesModule {}
