import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { WorkController } from "./work.controller.js";
import {
	ListWorksUseCase,
	GetGroupedWorksUseCase,
	GetWorkUseCase,
	SaveWorkUseCase,
	DeleteWorkUseCase,
} from "./work.useCases.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [WorkController],
	// one provider per use case, injected into the controller
	providers: [ListWorksUseCase, GetGroupedWorksUseCase, GetWorkUseCase, SaveWorkUseCase, DeleteWorkUseCase],
})
export class WorkModule {}
