import { Module } from "@nestjs/common";

import { BroadcastSharedModule } from "../broadcast/broadcast-shared.module.js";
import { EntitiesModule } from "../entities/entities.module.js";
import { GameSharedModule } from "../game/game-shared.module.js";
import { ReadingBookModule } from "../reading-book/reading-book.module.js";
import { ShowSharedModule } from "../show/show-shared.module.js";
import { SportModule } from "../sport/sport.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ImagesController } from "./images.controller.js";

// Each imported module exports the repository holding its file keys
@Module({
	imports: [
		StorageModule,
		BroadcastSharedModule,
		ReadingBookModule,
		EntitiesModule,
		SportModule,
		GameSharedModule,
		ShowSharedModule,
	],
	controllers: [ImagesController],
})
export class ImagesModule {}
