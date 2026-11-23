import { Module } from "@nestjs/common";

import { BroadcastSharedModule } from "../broadcast/broadcast-shared.module.js";
import { GameSharedModule } from "../game/game-shared.module.js";
import { MusicModule } from "../music/music.module.js";
import { ReadingBookModule } from "../reading-book/reading-book.module.js";
import { ReadingMangaModule } from "../reading-manga/reading-manga.module.js";
import { ShowSharedModule } from "../show/show-shared.module.js";
import { CalendarController } from "./calendar.controller.js";
import { CalendarService } from "./calendar.service.js";

// Reads every domain: each imported module exports the repository the calendar needs
@Module({
	imports: [
		MusicModule,
		BroadcastSharedModule,
		ReadingBookModule,
		ReadingMangaModule,
		ShowSharedModule,
		GameSharedModule,
	],
	controllers: [CalendarController],
	providers: [CalendarService],
})
export class CalendarModule {}
