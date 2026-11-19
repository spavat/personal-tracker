import { Module } from "@nestjs/common";

import { GameSharedModule } from "../game/game-shared.module.js";
import { InternetSharedModule } from "../internet/internet-shared.module.js";
import { MusicModule } from "../music/music.module.js";
import { ReadingBookModule } from "../reading-book/reading-book.module.js";
import { ReadingMangaModule } from "../reading-manga/reading-manga.module.js";
import { ShowSharedModule } from "../show/show-shared.module.js";
import { CalendarController } from "./calendar.controller.js";
import { GetDailyCalendarUseCase, GetMonthlyCalendarUseCase, GetPeriodCalendarUseCase } from "./calendar.useCases.js";

// Reads every domain: each imported module exports the repository the calendar needs
@Module({
	imports: [
		MusicModule,
		InternetSharedModule,
		ReadingBookModule,
		ReadingMangaModule,
		ShowSharedModule,
		GameSharedModule,
	],
	controllers: [CalendarController],
	providers: [GetMonthlyCalendarUseCase, GetPeriodCalendarUseCase, GetDailyCalendarUseCase],
})
export class CalendarModule {}
