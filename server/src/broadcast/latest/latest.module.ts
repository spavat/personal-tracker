import { Module } from "@nestjs/common";

import { BroadcastSharedModule } from "../broadcast-shared.module.js";
import { LatestController } from "./latest.controller.js";
import { LatestService } from "./latest.service.js";

@Module({
	imports: [BroadcastSharedModule],
	controllers: [LatestController],
	providers: [LatestService],
})
export class LatestModule {}
