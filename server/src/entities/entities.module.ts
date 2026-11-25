import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { EntitiesController } from "./entities.controller.js";
import { EntitiesRepository } from "./entities.repository.js";
import { EntitiesService } from "./entities.service.js";
import { PortraitStorage } from "./portrait.storage.js";

@Module({
	imports: [DatabaseModule, StorageModule],
	controllers: [EntitiesController],
	providers: [EntitiesRepository, PortraitStorage, EntitiesService],
	// read by the images proxy (the portrait key); the directory's merge deletes a portrait left over
	exports: [EntitiesRepository, PortraitStorage],
})
export class EntitiesModule {}
