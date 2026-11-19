import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { CategoriesController } from "./categories.controller.js";
import { CategoriesRepository } from "./categories.repository.js";
import { CategoriesService } from "./categories.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [CategoriesController],
	providers: [CategoriesService, CategoriesRepository],
	// read by the money recap
	exports: [CategoriesRepository],
})
export class CategoriesModule {}
