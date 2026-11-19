import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { WorksController } from "./works.controller.js";
import { WorksService } from "./works.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [WorksController],
	providers: [WorksService],
})
export class WorksModule {}
