import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { MediaController } from "./media.controller.js";
import {
	ListMediaUseCase,
	UploadMediaUseCase,
	UpdateMediaUseCase,
	ReorderMediaUseCase,
	DeleteMediaUseCase,
} from "./media.useCases.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [MediaController],
	// one provider per use case, injected into the controller
	providers: [ListMediaUseCase, UploadMediaUseCase, UpdateMediaUseCase, ReorderMediaUseCase, DeleteMediaUseCase],
})
export class MediaModule {}
