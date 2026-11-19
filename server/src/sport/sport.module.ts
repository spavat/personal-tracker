import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { SportFilesStorage } from "./sport-files.storage.js";
import { SportController } from "./sport.controller.js";
import { SportRepository } from "./sport.repository.js";
import { SportService } from "./sport.service.js";

@Module({
	imports: [DatabaseModule, StorageModule],
	controllers: [SportController],
	providers: [SportService, SportRepository, SportFilesStorage],
	// read by the images proxy (the thumbnail key)
	exports: [SportRepository],
})
export class SportModule {}
