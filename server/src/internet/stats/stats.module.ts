import { Module } from "@nestjs/common";

import { InternetSharedModule } from "../internet-shared.module.js";
import { StatsController } from "./stats.controller.js";
import { StatsService } from "./stats.service.js";

@Module({
	imports: [InternetSharedModule],
	controllers: [StatsController],
	providers: [StatsService],
})
export class StatsModule {}
