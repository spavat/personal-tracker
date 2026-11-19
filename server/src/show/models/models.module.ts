import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { ModelsController } from "./models.controller.js";
import { ModelsService } from "./models.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [ModelsController],
	providers: [ModelsService],
})
export class ModelsModule {}
