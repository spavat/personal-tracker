import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { GameImagesStorage } from "./game-images.storage.js";
import { GameRepository } from "./game.repository.js";

// What the game routes and the store sync share; its own module so GameSyncModule doesn't import its parent
@Module({
	imports: [DatabaseModule, StorageModule],
	providers: [GameRepository, GameImagesStorage],
	exports: [GameRepository, GameImagesStorage],
})
export class GameSharedModule {}
