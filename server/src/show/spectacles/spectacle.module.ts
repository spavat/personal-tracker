import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { SpectacleController } from "./spectacle.controller.js";
import {
	ListSpectaclesUseCase,
	GetGroupedSpectaclesUseCase,
	GetSpectacleUseCase,
	SaveSpectacleUseCase,
} from "./spectacle.useCases.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [SpectacleController],
	// one provider per use case, injected into the controller
	providers: [ListSpectaclesUseCase, GetGroupedSpectaclesUseCase, GetSpectacleUseCase, SaveSpectacleUseCase],
})
export class SpectacleModule {}
