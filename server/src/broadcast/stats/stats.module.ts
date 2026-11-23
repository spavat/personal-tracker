import { Module } from "@nestjs/common";

import { BroadcastSharedModule } from "../broadcast-shared.module.js";
import { StatsController } from "./stats.controller.js";
import { StatsService } from "./stats.service.js";

@Module({
	imports: [BroadcastSharedModule],
	controllers: [StatsController],
	providers: [StatsService],
})
export class StatsModule {}
