import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { PerformancesController } from "./performances.controller.js";
import { PerformancesService } from "./performances.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [PerformancesController],
	providers: [PerformancesService],
})
export class PerformancesModule {}
