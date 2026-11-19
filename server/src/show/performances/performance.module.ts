import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { PerformanceController } from "./performance.controller.js";
import { PerformanceService } from "./performance.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [PerformanceController],
	providers: [PerformanceService],
})
export class PerformanceModule {}
