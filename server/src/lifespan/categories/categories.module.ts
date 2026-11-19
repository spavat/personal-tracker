import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { LifespanCategoriesController } from "./categories.controller.js";
import { LifespanCategoriesRepository } from "./categories.repository.js";
import { LifespanCategoriesService } from "./categories.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [LifespanCategoriesController],
	providers: [LifespanCategoriesService, LifespanCategoriesRepository],
})
export class LifespanCategoriesModule {}
