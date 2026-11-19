import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { GenresController } from "./genres.controller.js";
import { GenresRepository } from "./genres.repository.js";
import { GenresService } from "./genres.service.js";
import { MusicStatsService } from "./music-stats.service.js";
import { MusicController } from "./music.controller.js";
import { MusicRepository } from "./music.repository.js";
import { MusicService } from "./music.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [MusicController, GenresController],
	providers: [MusicService, MusicStatsService, GenresService, MusicRepository, GenresRepository],
	// read by the calendar and the home page
	exports: [MusicRepository],
})
export class MusicModule {}
