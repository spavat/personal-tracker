import { Module } from "@nestjs/common";

import { InternetSharedModule } from "../internet-shared.module.js";
import { LatestController } from "./latest.controller.js";
import { LatestService } from "./latest.service.js";

@Module({
	imports: [InternetSharedModule],
	controllers: [LatestController],
	providers: [LatestService],
})
export class LatestModule {}
