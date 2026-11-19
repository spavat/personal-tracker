import { Module } from "@nestjs/common";

import { GameSharedModule } from "../game/game-shared.module.js";
import { InternetSharedModule } from "../internet/internet-shared.module.js";
import { MusicModule } from "../music/music.module.js";
import { ReadingBookModule } from "../reading-book/reading-book.module.js";
import { ReadingMangaModule } from "../reading-manga/reading-manga.module.js";
import { ShowSharedModule } from "../show/show-shared.module.js";
import { HomeController } from "./home.controller.js";
import { HomeService } from "./home.service.js";

// Reads every domain: each imported module exports the repository (and image storage) the home page needs
@Module({
	imports: [
		GameSharedModule,
		ShowSharedModule,
		MusicModule,
		InternetSharedModule,
		ReadingMangaModule,
		ReadingBookModule,
	],
	controllers: [HomeController],
	providers: [HomeService],
})
export class HomeModule {}
