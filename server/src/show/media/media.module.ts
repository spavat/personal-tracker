import { Module } from "@nestjs/common";

import { ShowSharedModule } from "../show-shared.module.js";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";

@Module({
	imports: [ShowSharedModule],
	controllers: [MediaController],
	providers: [MediaService],
})
export class MediaModule {}
