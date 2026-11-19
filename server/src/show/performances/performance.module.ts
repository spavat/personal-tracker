import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { PerformanceController } from "./performance.controller.js";
import {
	ListPerformancesUseCase,
	GetPerformanceUseCase,
	SavePerformanceUseCase,
	SaveCastingUseCase,
	DeletePerformanceUseCase,
} from "./performance.useCases.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [PerformanceController],
	// one provider per use case, injected into the controller
	providers: [
		ListPerformancesUseCase,
		GetPerformanceUseCase,
		SavePerformanceUseCase,
		SaveCastingUseCase,
		DeletePerformanceUseCase,
	],
})
export class PerformanceModule {}
