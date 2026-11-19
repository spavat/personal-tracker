import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { ModelController } from "./model.controller.js";
import { GetModelUseCase, SaveModelUseCase, DeleteModelUseCase } from "./model.useCases.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [ModelController],
	// one provider per use case, injected into the controller
	providers: [GetModelUseCase, SaveModelUseCase, DeleteModelUseCase],
})
export class ModelModule {}
