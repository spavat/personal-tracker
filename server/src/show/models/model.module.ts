import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { ModelController } from "./model.controller.js";
import { ModelService } from "./model.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [ModelController],
	providers: [ModelService],
})
export class ModelModule {}
