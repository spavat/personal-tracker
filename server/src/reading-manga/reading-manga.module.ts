import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { ReadingMangaController } from "./reading-manga.controller.js";
import { ReadingMangaRepository } from "./reading-manga.repository.js";
import { ReadingMangaService } from "./reading-manga.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [ReadingMangaController],
	providers: [ReadingMangaService, ReadingMangaRepository],
	// read by the calendar and the home page
	exports: [ReadingMangaRepository],
})
export class ReadingMangaModule {}
