import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { LifespanObjectsController } from "./objects.controller.js";
import { LifespanObjectsRepository } from "./objects.repository.js";
import { LifespanObjectsService } from "./objects.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [LifespanObjectsController],
	providers: [LifespanObjectsService, LifespanObjectsRepository],
})
export class LifespanObjectsModule {}
