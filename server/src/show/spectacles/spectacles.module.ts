import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { SpectaclesController } from "./spectacles.controller.js";
import { SpectaclesService } from "./spectacles.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [SpectaclesController],
	providers: [SpectaclesService],
})
export class SpectaclesModule {}
