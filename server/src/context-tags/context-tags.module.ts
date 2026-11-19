import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { ContextTagsController } from "./context-tags.controller.js";
import { ContextTagsRepository } from "./context-tags.repository.js";
import { ContextTagsService } from "./context-tags.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [ContextTagsController],
	providers: [ContextTagsService, ContextTagsRepository],
	// read by the reading-book report (tag groups)
	exports: [ContextTagsRepository],
})
export class ContextTagsModule {}
