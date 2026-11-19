import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { EntityController } from "./entity.controller.js";
import { EntityRepository } from "./entity.repository.js";
import { EntityService } from "./entity.service.js";
import { PortraitStorage } from "./portrait.storage.js";

@Module({
	imports: [DatabaseModule, StorageModule],
	controllers: [EntityController],
	providers: [EntityRepository, PortraitStorage, EntityService],
	// read by the images proxy (the portrait key)
	exports: [EntityRepository],
})
export class EntitiesModule {}
