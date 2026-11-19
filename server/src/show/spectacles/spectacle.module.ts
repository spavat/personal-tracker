import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { SpectacleController } from "./spectacle.controller.js";
import { SpectacleService } from "./spectacle.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [SpectacleController],
	providers: [SpectacleService],
})
export class SpectacleModule {}
