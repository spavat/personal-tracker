import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { AuthModule } from "./auth/auth.module.js";
import { BroadcastModule } from "./broadcast/broadcast.module.js";
import { CalendarModule } from "./calendar/calendar.module.js";
import { CommonModule } from "./common/common.module.js";
import { envSchema } from "./config/env.schema.js";
import { ContextTagsModule } from "./context-tags/context-tags.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { EntitiesModule } from "./entities/entities.module.js";
import { GameModule } from "./game/game.module.js";
import { HealthController } from "./health/health.controller.js";
import { HomeModule } from "./home/home.module.js";
import { ImagesModule } from "./images/images.module.js";
import { LifespanModule } from "./lifespan/lifespan.module.js";
import { MoneyModule } from "./money/money.module.js";
import { MusicModule } from "./music/music.module.js";
import { ReadingBookModule } from "./reading-book/reading-book.module.js";
import { ReadingMangaModule } from "./reading-manga/reading-manga.module.js";
import { ShowModule } from "./show/show.module.js";
import { SportModule } from "./sport/sport.module.js";

@Module({
	controllers: [HealthController],
	imports: [
		ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
		// runs the @Cron() methods (GameSyncJob)
		ScheduleModule.forRoot(),
		CommonModule,
		DatabaseModule,
		ContextTagsModule,
		AuthModule,
		MoneyModule,
		ReadingMangaModule,
		MusicModule,
		LifespanModule,
		SportModule,
		BroadcastModule,
		GameModule,
		ReadingBookModule,
		ShowModule,
		EntitiesModule,
		ImagesModule,
		CalendarModule,
		HomeModule,
	],
})
export class AppModule {}
