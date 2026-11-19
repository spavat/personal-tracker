import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { WorkController } from "./work.controller.js";
import { WorkService } from "./work.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [WorkController],
	providers: [WorkService],
})
export class WorkModule {}
